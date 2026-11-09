"""Loaded explicitly by GDB. Save stack locations, never arguments or memory."""
import json
import os
import signal

import gdb

_file = os.environ["JOB_DESCRIPTION_NATIVE_DIAGNOSTIC_FILE"]
_fatal_signal = None
_fatal = {"SIGSEGV", "SIGABRT", "SIGBUS", "SIGILL", "SIGFPE"}

for _command in (
    "set pagination off",
    "set confirm off",
    "set print frame-arguments none",
    "set print entry-values no",
    "set print frame-info location",
    "set backtrace limit 24",
    "handle SIGPIPE SIGALRM SIGUSR1 SIGUSR2 nostop noprint pass",
):
    gdb.execute(_command)


def _save(value):
    temporary = _file + ".tmp"
    with open(temporary, "w", encoding="utf-8") as output:
        json.dump(value, output)
        output.write("\n")
    os.replace(temporary, _file)


def _continued(_event):
    if _fatal_signal is None:
        _save({"pid": gdb.selected_inferior().pid, "debugger": "gdb", "state": "running"})


def _stopped(event):
    global _fatal_signal
    if not isinstance(event, gdb.SignalEvent) or event.stop_signal not in _fatal:
        return
    _fatal_signal = event.stop_signal
    value = {"pid": gdb.selected_inferior().pid, "debugger": "gdb", "signal": _fatal_signal}
    try:
        current = gdb.selected_thread()
        threads = [current] + [thread for thread in gdb.selected_inferior().threads() if thread.global_num != current.global_num]
        frames = []
        for thread in threads[:16]:
            thread.switch()
            frames.append("Thread %s\n%s" % (thread.global_num, gdb.execute("bt 24", to_string=True)))
            if sum(map(len, frames)) >= 32768:
                break
        value["backtrace"] = "\n".join(frames)[:32768]
    except Exception:
        value["backtraceUnavailable"] = "capture_failed"
    _save(value)


def finish_rewrite_debugging():
    if _fatal_signal:
        # The inferior is stopped before signal delivery. Kill it without a core
        # dump, then make the debugger preserve the fatal outcome for its parent.
        status = 128 + int(getattr(signal, _fatal_signal))
        gdb.execute("kill")
        gdb.execute("quit %s" % status)
    elif gdb.selected_inferior().pid:
        _save({"pid": gdb.selected_inferior().pid, "debugger": "gdb", "backtraceUnavailable": "unexpected_stop"})
        gdb.execute("kill")
        gdb.execute("quit 1")


gdb.events.cont.connect(_continued)
gdb.events.stop.connect(_stopped)
