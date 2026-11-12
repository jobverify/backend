import { createHash } from 'node:crypto';
import { types, isDeepStrictEqual } from 'node:util';

// Exact original baseline, not a normalized/reconstructed response. Only the
// twelve independently located, typed string tokens below may differ. New
// authored/schema/format versions require a separate review.
const BASELINE_BASE64 = 'eyJkYXRhIjp7InNvdXJjaW5nRm9ybSI6eyJpZCI6IjBmNmI2ZDg0LThlYTUtNDk1NS1iOGY4LTViNGI3MzEyZWFhZiIsIm9yZ2FuaXphdGlvbklkIjoiNmVlNDQ3OWUtZjg2OC00NDIzLTgzZGItMjQyZTE0ZjcxYjM5Iiwic291cmNpbmdGb3JtUmVuZGVyIjp7ImlkIjoiNTliNDQ2YmQtOThlNy00ZmRlLTg0N2QtZGQyZjExZDVhZTA0IiwiZm9ybUNvbnRyb2xzIjpbeyJpZGVudGlmaWVyIjoiZmE5NTI5MGEtOThmNC00N2MxLWFkMzEtYWZhMjQ3OTk4NGFiIiwidGl0bGUiOiJTdWJtaXQiLCJfX3R5cGVuYW1lIjoiRm9ybUNvbnRyb2wifV0sImVycm9yTWVzc2FnZXMiOltdLCJmb3JtRXJyb3JzIjpbXSwic2VjdGlvbnMiOlt7InRpdGxlIjpudWxsLCJkZXNjcmlwdGlvbkh0bWwiOm51bGwsImZpZWxkRW50cmllcyI6W3siaWQiOiI1OWI0NDZiZC05OGU3LTRmZGUtODQ3ZC1kZDJmMTFkNWFlMDRfX3N5c3RlbWZpZWxkX25hbWUiLCJmaWVsZCI6eyJpZCI6IjVjNTFmZjkxLTJiYjAtNGNiOS1iZGQ4LWIzOGJiYWFmYjMxMiIsInBhdGgiOiJfc3lzdGVtZmllbGRfbmFtZSIsImh1bWFuUmVhZGFibGVQYXRoIjoiTmFtZSIsInRpdGxlIjoiTmFtZSBbIEZpcnN0LCBMYXN0XToiLCJpc051bGxhYmxlIjpmYWxzZSwiaXNQcml2YXRlIjpmYWxzZSwiaXNEZWFjdGl2YXRlZCI6ZmFsc2UsImlzTWFueSI6ZmFsc2UsIm1ldGFkYXRhIjp7fSwidHlwZSI6IlN0cmluZyIsIl9fYXV0b1NlcmlhbGl6YXRpb25JRCI6IlN0cmluZ0ZpZWxkIn0sImZpZWxkVmFsdWUiOm51bGwsImlzUmVxdWlyZWQiOnRydWUsImRlc2NyaXB0aW9uSHRtbCI6bnVsbCwiaXNIaWRkZW4iOm51bGwsIl9fdHlwZW5hbWUiOiJGb3JtRmllbGRFbnRyeSJ9LHsiaWQiOiI1OWI0NDZiZC05OGU3LTRmZGUtODQ3ZC1kZDJmMTFkNWFlMDRfX3N5c3RlbWZpZWxkX2VtYWlsIiwiZmllbGQiOnsiaWQiOiI2YTg4NTdmZS05YzQ0LTRhMTItOTEyNy00OWU0ODQ5MjIyMDUiLCJwYXRoIjoiX3N5c3RlbWZpZWxkX2VtYWlsIiwiaHVtYW5SZWFkYWJsZVBhdGgiOiJFbWFpbCIsInRpdGxlIjoiRW1haWw6IiwiaXNOdWxsYWJsZSI6ZmFsc2UsImlzUHJpdmF0ZSI6ZmFsc2UsImlzRGVhY3RpdmF0ZWQiOmZhbHNlLCJpc01hbnkiOmZhbHNlLCJtZXRhZGF0YSI6e30sInR5cGUiOiJFbWFpbCIsIl9fYXV0b1NlcmlhbGl6YXRpb25JRCI6IkVtYWlsRmllbGQifSwiZmllbGRWYWx1ZSI6bnVsbCwiaXNSZXF1aXJlZCI6dHJ1ZSwiZGVzY3JpcHRpb25IdG1sIjpudWxsLCJpc0hpZGRlbiI6bnVsbCwiX190eXBlbmFtZSI6IkZvcm1GaWVsZEVudHJ5In0seyJpZCI6IjU5YjQ0NmJkLTk4ZTctNGZkZS04NDdkLWRkMmYxMWQ1YWUwNF9jYTYzYTNmYy02YzU3LTQ2YTEtYWEyNS05MzM5ZTAyOTRlNWIiLCJmaWVsZCI6eyJpZCI6IjFjMTRiN2JlLWEzMTEtNGRjYS1iYTkyLTZjMDViOTFlODM2MiIsInBhdGgiOiJjYTYzYTNmYy02YzU3LTQ2YTEtYWEyNS05MzM5ZTAyOTRlNWIiLCJodW1hblJlYWRhYmxlUGF0aCI6IiIsInRpdGxlIjoiUHJpbWFyeSBBcmVhIG9mIEV4cGVydGlzZToiLCJpc051bGxhYmxlIjpmYWxzZSwiaXNQcml2YXRlIjpmYWxzZSwiaXNEZWFjdGl2YXRlZCI6ZmFsc2UsImlzTWFueSI6ZmFsc2UsIm1ldGFkYXRhIjp7fSwidHlwZSI6IlZhbHVlU2VsZWN0Iiwic2VsZWN0YWJsZVZhbHVlcyI6W3sibGFiZWwiOiJFbmdpbmVlcmluZyAoQmFja2VuZCwgRnJvbnRlbmQsIEZ1bGwgU3RhY2spIiwidmFsdWUiOiJFbmdpbmVlcmluZyAoQmFja2VuZCwgRnJvbnRlbmQsIEZ1bGwgU3RhY2spIn0seyJsYWJlbCI6Ik1hY2hpbmUgTGVhcm5pbmcgLyBBSSBSZXNlYXJjaCIsInZhbHVlIjoiTWFjaGluZSBMZWFybmluZyAvIEFJIFJlc2VhcmNoIiwiaXNBcmNoaXZlZCI6ZmFsc2V9LHsibGFiZWwiOiJQcm9kdWN0IE1hbmFnZW1lbnQgJiBEZXNpZ24iLCJ2YWx1ZSI6IlByb2R1Y3QgTWFuYWdlbWVudCAmIERlc2lnbiIsImlzQXJjaGl2ZWQiOmZhbHNlfSx7ImxhYmVsIjoiRW50ZXJwcmlzZSBTYWxlcy9BY2NvdW50IE1hbmFnZW1lbnQiLCJ2YWx1ZSI6IkVudGVycHJpc2UgU2FsZXMvQWNjb3VudCBNYW5hZ2VtZW50IiwiaXNBcmNoaXZlZCI6ZmFsc2V9LHsibGFiZWwiOiJNYXJrZXRpbmcgJiBDb21tdW5pY2F0aW9ucyIsInZhbHVlIjoiTWFya2V0aW5nICYgQ29tbXVuaWNhdGlvbnMiLCJpc0FyY2hpdmVkIjpmYWxzZX0seyJsYWJlbCI6IkcmQSAoRmluYW5jZSwgSFIsIExlZ2FsLCBPcHMpIiwidmFsdWUiOiJHJkEgKEZpbmFuY2UsIEhSLCBMZWdhbCwgT3BzKSIsImlzQXJjaGl2ZWQiOmZhbHNlfSx7ImxhYmVsIjoiRm9yd2FyZCBEZXBsb3llZCBFbmdpbmVlcmluZyAoUHJlLXNhbGVzICYgSW1wbGVtZW50YXRpb24pICIsInZhbHVlIjoiRm9yd2FyZCBEZXBsb3llZCBFbmdpbmVlcmluZyAoUHJlLXNhbGVzICYgSW1wbGVtZW50YXRpb24pICIsImlzQXJjaGl2ZWQiOmZhbHNlfV0sIl9fYXV0b1NlcmlhbGl6YXRpb25JRCI6IlZhbHVlU2VsZWN0RmllbGQifSwiZmllbGRWYWx1ZSI6bnVsbCwiaXNSZXF1aXJlZCI6dHJ1ZSwiZGVzY3JpcHRpb25IdG1sIjpudWxsLCJpc0hpZGRlbiI6bnVsbCwiX190eXBlbmFtZSI6IkZvcm1GaWVsZEVudHJ5In0seyJpZCI6IjU5YjQ0NmJkLTk4ZTctNGZkZS04NDdkLWRkMmYxMWQ1YWUwNF9jMDFlMmVlNC1mMjdlLTRjZWYtYTY3YS1jZTM4YjVlYTAzOTUiLCJmaWVsZCI6eyJpZCI6ImEwNDBiYWEwLTY0MmItNDI1ZS1iZmExLWMxYzJkNWQ5YTQ2YSIsInBhdGgiOiJjMDFlMmVlNC1mMjdlLTRjZWYtYTY3YS1jZTM4YjVlYTAzOTUiLCJodW1hblJlYWRhYmxlUGF0aCI6IiIsInRpdGxlIjoiV2hhdCB0eXBlIG9mIHJvbGVzIGFyZSB5b3UgbG9va2luZyBmb3IgaW4gdGhlIGZ1dHVyZT8iLCJpc051bGxhYmxlIjpmYWxzZSwiaXNQcml2YXRlIjpmYWxzZSwiaXNEZWFjdGl2YXRlZCI6ZmFsc2UsImlzTWFueSI6ZmFsc2UsIm1ldGFkYXRhIjp7fSwidHlwZSI6IlZhbHVlU2VsZWN0Iiwic2VsZWN0YWJsZVZhbHVlcyI6W3sibGFiZWwiOiJGdWxsLXRpbWUiLCJ2YWx1ZSI6IkZ1bGwtdGltZSJ9LHsibGFiZWwiOiJDb250cmFjdCAvIEZyZWVsYW5jZSIsInZhbHVlIjoiQ29udHJhY3QgLyBGcmVlbGFuY2UiLCJpc0FyY2hpdmVkIjpmYWxzZX0seyJsYWJlbCI6IkludGVybnNoaXBzIC8gTmV3IEdyYWQiLCJ2YWx1ZSI6IkludGVybnNoaXBzIC8gTmV3IEdyYWQiLCJpc0FyY2hpdmVkIjpmYWxzZX1dLCJfX2F1dG9TZXJpYWxpemF0aW9uSUQiOiJWYWx1ZVNlbGVjdEZpZWxkIn0sImZpZWxkVmFsdWUiOm51bGwsImlzUmVxdWlyZWQiOnRydWUsImRlc2NyaXB0aW9uSHRtbCI6bnVsbCwiaXNIaWRkZW4iOm51bGwsIl9fdHlwZW5hbWUiOiJGb3JtRmllbGRFbnRyeSJ9LHsiaWQiOiI1OWI0NDZiZC05OGU3LTRmZGUtODQ3ZC1kZDJmMTFkNWFlMDRfYjY2YjBiYjMtY2JiOC00MThlLTgzN2MtMWQwMGU5NzMxNTExIiwiZmllbGQiOnsiaWQiOiJiZDNhYjI0NS1hZGNmLTQ1YmMtYWQ2MS0xZmZmYTUxOTE0MjUiLCJwYXRoIjoiYjY2YjBiYjMtY2JiOC00MThlLTgzN2MtMWQwMGU5NzMxNTExIiwiaHVtYW5SZWFkYWJsZVBhdGgiOiIiLCJ0aXRsZSI6IkN1cnJlbnQgTG9jYXRpb246IiwiaXNOdWxsYWJsZSI6ZmFsc2UsImlzUHJpdmF0ZSI6ZmFsc2UsImlzRGVhY3RpdmF0ZWQiOmZhbHNlLCJpc01hbnkiOmZhbHNlLCJtZXRhZGF0YSI6e30sInR5cGUiOiJTdHJpbmciLCJfX2F1dG9TZXJpYWxpemF0aW9uSUQiOiJTdHJpbmdGaWVsZCJ9LCJmaWVsZFZhbHVlIjpudWxsLCJpc1JlcXVpcmVkIjp0cnVlLCJkZXNjcmlwdGlvbkh0bWwiOiI8cD5UaGlzIGluZm9ybWF0aW9uIGhlbHBzIHVzIHdoZW4gc291cmNpbmcgZm9yIHNwZWNpZmljIHRpbWV6b25lcyBhbmQgZ2VvZ3JhcGhpZXM8L3A+IiwiaXNIaWRkZW4iOm51bGwsIl9fdHlwZW5hbWUiOiJGb3JtRmllbGRFbnRyeSJ9LHsiaWQiOiI1OWI0NDZiZC05OGU3LTRmZGUtODQ3ZC1kZDJmMTFkNWFlMDRfYzc0OTM0NjMtNmQ3ZC00MGE2LThiZWMtN2JjYjI4NTJmMDFjIiwiZmllbGQiOnsiaWQiOiI0NjVhNjQ2Mi0yZTc4LTQxNGYtYmZmYi1mYTRjMWRlNDAzNTIiLCJwYXRoIjoiYzc0OTM0NjMtNmQ3ZC00MGE2LThiZWMtN2JjYjI4NTJmMDFjIiwiaHVtYW5SZWFkYWJsZVBhdGgiOiIiLCJ0aXRsZSI6IkxpbmtlZEluIFByb2ZpbGUiLCJpc051bGxhYmxlIjpmYWxzZSwiaXNQcml2YXRlIjpmYWxzZSwiaXNEZWFjdGl2YXRlZCI6ZmFsc2UsImlzTWFueSI6ZmFsc2UsIm1ldGFkYXRhIjp7fSwidHlwZSI6IlVybCIsIl9fYXV0b1NlcmlhbGl6YXRpb25JRCI6IlVybEZpZWxkIn0sImZpZWxkVmFsdWUiOm51bGwsImlzUmVxdWlyZWQiOnRydWUsImRlc2NyaXB0aW9uSHRtbCI6bnVsbCwiaXNIaWRkZW4iOm51bGwsIl9fdHlwZW5hbWUiOiJGb3JtRmllbGRFbnRyeSJ9LHsiaWQiOiI1OWI0NDZiZC05OGU3LTRmZGUtODQ3ZC1kZDJmMTFkNWFlMDRfZDY5ODA3M2EtODY4Yy00NjMzLWE4YWUtMjk0M2M4ODQ2N2M4IiwiZmllbGQiOnsiaWQiOiI2YmQ5MDg5YS01MWE2LTQ3NDItYmQ1Yi02MjhhM2ZjNGUzY2MiLCJwYXRoIjoiZDY5ODA3M2EtODY4Yy00NjMzLWE4YWUtMjk0M2M4ODQ2N2M4IiwiaHVtYW5SZWFkYWJsZVBhdGgiOiIiLCJ0aXRsZSI6IldlYnNpdGUvUG9ydGZvbGlvIiwiaXNOdWxsYWJsZSI6ZmFsc2UsImlzUHJpdmF0ZSI6ZmFsc2UsImlzRGVhY3RpdmF0ZWQiOmZhbHNlLCJpc01hbnkiOmZhbHNlLCJtZXRhZGF0YSI6e30sInR5cGUiOiJVcmwiLCJfX2F1dG9TZXJpYWxpemF0aW9uSUQiOiJVcmxGaWVsZCJ9LCJmaWVsZFZhbHVlIjpudWxsLCJpc1JlcXVpcmVkIjpmYWxzZSwiZGVzY3JpcHRpb25IdG1sIjpudWxsLCJpc0hpZGRlbiI6bnVsbCwiX190eXBlbmFtZSI6IkZvcm1GaWVsZEVudHJ5In0seyJpZCI6IjU5YjQ0NmJkLTk4ZTctNGZkZS04NDdkLWRkMmYxMWQ1YWUwNF84NzE4MTkzMC1jYjJjLTQzY2MtYjZlZC1kNGJlNDgwYjhhZDQiLCJmaWVsZCI6eyJpZCI6ImZmMDhjNzFiLTQ4ZTktNGRkOS05YjIzLWI2ZTM3YTdiOGVhNCIsInBhdGgiOiI4NzE4MTkzMC1jYjJjLTQzY2MtYjZlZC1kNGJlNDgwYjhhZDQiLCJodW1hblJlYWRhYmxlUGF0aCI6IiIsInRpdGxlIjoiV2hhdCBleGNpdGVzIHlvdSBhYm91dCBwb3RlbnRpYWxseSBqb2luaW5nIEh5cGVyc2NpZW5jZT8iLCJpc051bGxhYmxlIjpmYWxzZSwiaXNQcml2YXRlIjpmYWxzZSwiaXNEZWFjdGl2YXRlZCI6ZmFsc2UsImlzTWFueSI6ZmFsc2UsIm1ldGFkYXRhIjp7fSwidHlwZSI6IkxvbmdUZXh0IiwiX19hdXRvU2VyaWFsaXphdGlvbklEIjoiTG9uZ1RleHRGaWVsZCJ9LCJmaWVsZFZhbHVlIjpudWxsLCJpc1JlcXVpcmVkIjp0cnVlLCJkZXNjcmlwdGlvbkh0bWwiOm51bGwsImlzSGlkZGVuIjpudWxsLCJfX3R5cGVuYW1lIjoiRm9ybUZpZWxkRW50cnkifSx7ImlkIjoiNTliNDQ2YmQtOThlNy00ZmRlLTg0N2QtZGQyZjExZDVhZTA0XzIzN2VhODZmLWQ0YjYtNGVlNi1hNmJlLTRiZTJmMmZhMGM1YiIsImZpZWxkIjp7ImlkIjoiYTRkZjFlMzktYTgxNy00N2E4LWFlYWQtODAyZWExZWRmMjgxIiwicGF0aCI6IjIzN2VhODZmLWQ0YjYtNGVlNi1hNmJlLTRiZTJmMmZhMGM1YiIsImh1bWFuUmVhZGFibGVQYXRoIjoiIiwidGl0bGUiOiJBbnl0aGluZyBlbHNlIHdlIHNob3VsZCBrbm93PyIsImlzTnVsbGFibGUiOmZhbHNlLCJpc1ByaXZhdGUiOmZhbHNlLCJpc0RlYWN0aXZhdGVkIjpmYWxzZSwiaXNNYW55IjpmYWxzZSwibWV0YWRhdGEiOnt9LCJ0eXBlIjoiTG9uZ1RleHQiLCJfX2F1dG9TZXJpYWxpemF0aW9uSUQiOiJMb25nVGV4dEZpZWxkIn0sImZpZWxkVmFsdWUiOm51bGwsImlzUmVxdWlyZWQiOmZhbHNlLCJkZXNjcmlwdGlvbkh0bWwiOm51bGwsImlzSGlkZGVuIjpudWxsLCJfX3R5cGVuYW1lIjoiRm9ybUZpZWxkRW50cnkifSx7ImlkIjoiNTliNDQ2YmQtOThlNy00ZmRlLTg0N2QtZGQyZjExZDVhZTA0X19zeXN0ZW1maWVsZF9yZXN1bWUiLCJmaWVsZCI6eyJpZCI6IjQ4NjI2ZTkzLTZhZDYtNDlhNy1hZjViLTUwZTMxNTk3MDNhNCIsInBhdGgiOiJfc3lzdGVtZmllbGRfcmVzdW1lIiwiaHVtYW5SZWFkYWJsZVBhdGgiOiJSZXN1bWUiLCJ0aXRsZSI6IlJlc3VtZSIsImlzTnVsbGFibGUiOmZhbHNlLCJpc1ByaXZhdGUiOmZhbHNlLCJpc0RlYWN0aXZhdGVkIjpmYWxzZSwiaXNNYW55IjpmYWxzZSwibWV0YWRhdGEiOnt9LCJ0eXBlIjoiRmlsZSIsImF0dGFjaEZpbGVUb0NhbmRpZGF0ZSI6dHJ1ZSwiX19hdXRvU2VyaWFsaXphdGlvbklEIjoiRmlsZUZpZWxkIn0sImZpZWxkVmFsdWUiOm51bGwsImlzUmVxdWlyZWQiOnRydWUsImRlc2NyaXB0aW9uSHRtbCI6bnVsbCwiaXNIaWRkZW4iOm51bGwsIl9fdHlwZW5hbWUiOiJGb3JtRmllbGRFbnRyeSJ9XSwiaXNIaWRkZW4iOm51bGwsIl9fdHlwZW5hbWUiOiJGb3JtU2VjdGlvblJlbmRlciJ9XSwic291cmNlRm9ybURlZmluaXRpb25JZCI6IjBmNmI2ZDg0LThlYTUtNDk1NS1iOGY4LTViNGI3MzEyZWFhZiIsIl9fdHlwZW5hbWUiOiJGb3JtUmVuZGVyIn0sInB1YmxpY1RpdGxlIjoiVGFsZW50IENvbW11bml0eSAiLCJkZXNjcmlwdGlvbkhlYWRlckh0bWwiOiI8cCBzdHlsZT1cIm1pbi1oZWlnaHQ6MS41ZW1cIj48c3Ryb25nPkRvbuKAmXQgc2VlIHlvdXIgbmV4dCByb2xlIGxpc3RlZD8gTGV0J3MgY2hhbmdlIHRoYXQuPC9zdHJvbmc+PC9wPjxwIHN0eWxlPVwibWluLWhlaWdodDoxLjVlbVwiPkh5cGVyc2NpZW5jZSBpcyBncm93aW5nIGZhc3QsIGFuZCBvdXIgdGFsZW50IG5lZWRzIGV2b2x2ZSBldmVyeSBkYXkuIEJ5IGpvaW5pbmcgb3VyIFRhbGVudCBDb21tdW5pdHksIHdlJ2xsIGtlZXAgeW91IGluIG1pbmQgZm9yIHVwY29taW5nIG9wcG9ydHVuaXRpZXMgYW5kIHJlYWNoIG91dCB0aGUgbW9tZW50IGEgbWF0Y2ggb3BlbnMgdXAuPC9wPiIsImRlc2NyaXB0aW9uRm9vdGVySHRtbCI6IjxwIHN0eWxlPVwibWluLWhlaWdodDoxLjVlbVwiPjxlbT48c3Ryb25nPkFJIFRyYW5zcGFyZW5jeSBOb3RpY2U6PC9zdHJvbmc+IFdlIHVzZSBBSSB0b29scyB0byBhc3Npc3Qgb3VyIHRlYW0gaW4gc2NyZWVuaW5nIHJlc3VtZXMgZm9yIGpvYi1yZWxhdGVkIHNraWxscyBhbmQgcXVhbGlmaWNhdGlvbnMsIHRob3VnaCBhIGh1bWFuIHJlY3J1aXRlciB1bHRpbWF0ZWx5IHJldmlld3MgYWxsIGFwcGxpY2F0aW9ucyBiZWZvcmUgYW55IGhpcmluZyBkZWNpc2lvbnMgYXJlIG1hZGUuIEluIGFjY29yZGFuY2Ugd2l0aCBOb3J0aCBBbWVyaWNhbiwgVW5pdGVkIEtpbmdkb20sIGFuZCBFdXJvcGVhbiBVbmlvbiAoR0RQUikgcmVndWxhdGlvbnMsIHlvdSBoYXZlIHRoZSByaWdodCB0byByZXF1ZXN0IGEgbWFudWFsIHJldmlldyBvZiB5b3VyIGFwcGxpY2F0aW9uIG9yIGEgcmVhc29uYWJsZSBhY2NvbW1vZGF0aW9uIGlmIHlvdSBwcmVmZXIgYW4gYWx0ZXJuYXRpdmUgdG8gYXV0b21hdGVkIHNjcmVlbmluZy4gRm9yIG1vcmUgZGV0YWlscyBvbiB0aGUgbG9naWMgdXNlZCBvciB0byBleGVyY2lzZSB0aGVzZSByaWdodHMsIHBsZWFzZSBjb250YWN0IDwvZW0+PGEgdGFyZ2V0PVwiX2JsYW5rXCIgcmVsPVwibm9vcGVuZXIgbm9yZWZlcnJlclwiIGhyZWY9XCJtYWlsdG86cmVjcnVpdGluZ0BoeXBlcnNjaWVuY2UuYWlcIj48ZW0+cmVjcnVpdGluZ0BoeXBlcnNjaWVuY2UuYWk8L2VtPjwvYT48ZW0+LjwvZW0+PC9wPjxwIHN0eWxlPVwibWluLWhlaWdodDoxLjVlbVwiPjxlbT48c3Ryb25nPkJld2FyZSBvZiByZWNydWl0bWVudCBmcmF1ZDwvc3Ryb25nPjsgYWxsIG9mZmljaWFsIEh5cGVyc2NpZW5jZSBjb21tdW5pY2F0aW9uIGlzIHNlbnQgZXhjbHVzaXZlbHkgZnJvbSB0aGUgPHN0cm9uZz5APC9zdHJvbmc+PC9lbT48YSB0YXJnZXQ9XCJfYmxhbmtcIiByZWw9XCJub29wZW5lciBub3JlZmVycmVyIG5vZm9sbG93XCIgaHJlZj1cImh0dHA6Ly9oeXBlcnNjaWVuY2UuYWlcIj48ZW0+PHN0cm9uZz5oeXBlcnNjaWVuY2UuYWk8L3N0cm9uZz48L2VtPjwvYT48ZW0+IGRvbWFpbiwgYW5kIHdlIG5ldmVyIGV4dGVuZCBvZmZlcnMgd2l0aG91dCBtdWx0aXBsZSBsaXZlIGludGVydmlld3MuIFBlcnNvbmFsIGluZm9ybWF0aW9uIGlzIG9ubHkgcmVxdWVzdGVkIHRocm91Z2ggb3VyIHNlY3VyZSBhcHBsaWNhdGlvbiBwcm9jZXNzIG9yIHZpYSB2ZXJpZmllZCBiYWNrZ3JvdW5kIGNoZWNrIHBhcnRuZXJzIGR1cmluZyBvbmJvYXJkaW5nLjwvZW0+PC9wPiIsInN1Ym1pc3Npb25TdWNjZXNzTWVzc2FnZUh0bWwiOm51bGwsInN1Ym1pdEJ1dHRvblRleHQiOm51bGwsInNob3dBdXRvZmlsbEJveCI6dHJ1ZSwib3JnYW5pemF0aW9uQnJhbmQiOnsiaG9zdGVkSm9ic1BhZ2VTbHVnIjoiaHlwZXJzY2llbmNlIiwiX190eXBlbmFtZSI6Ik9yZ2FuaXphdGlvbkJyYW5kIn0sIl9fdHlwZW5hbWUiOiJTb3VyY2luZ0Zvcm1XaXRoRm9ybVJlbmRlciJ9fX0=';
const REQUEST_BASE64 = 'eyJvcGVyYXRpb25OYW1lIjoiQXBpU291cmNpbmdGb3JtIiwidmFyaWFibGVzIjp7Im9yZ2FuaXphdGlvbkhvc3RlZEpvYnNQYWdlTmFtZSI6Ikh5cGVyc2NpZW5jZSIsInNvdXJjaW5nRm9ybVNsdWciOiJ0YWxlbnQtY29tbXVuaXR5In0sInF1ZXJ5IjoiIyBTdGF0aWMgZG9jdW1lbnQgZGVyaXZlZCBmcm9tIG9yaWdpbmFsIHNlbGVjdGVkIGN1cnJlbnQgZW50cnkgQVNULiBObyByZXF1ZXN0IGhhcyBiZWVuIGF1dGhvcml6ZWQgb3IgZXhlY3V0ZWQuXG5xdWVyeSBBcGlTb3VyY2luZ0Zvcm0oJG9yZ2FuaXphdGlvbkhvc3RlZEpvYnNQYWdlTmFtZTogU3RyaW5nISwgJHNvdXJjaW5nRm9ybUlkOiBTdHJpbmcsICRzb3VyY2luZ0Zvcm1TbHVnOiBTdHJpbmcpIHtcbiAgc291cmNpbmdGb3JtKG9yZ2FuaXphdGlvbkhvc3RlZEpvYnNQYWdlTmFtZTogJG9yZ2FuaXphdGlvbkhvc3RlZEpvYnNQYWdlTmFtZSwgc291cmNpbmdGb3JtSWQ6ICRzb3VyY2luZ0Zvcm1JZCwgc291cmNpbmdGb3JtU2x1ZzogJHNvdXJjaW5nRm9ybVNsdWcpIHtcbiAgICAuLi5Tb3VyY2luZ0Zvcm1XaXRoRm9ybVJlbmRlclBhcnRzXG4gICAgX190eXBlbmFtZVxuICB9XG59XG5cbmZyYWdtZW50IEpTT05Cb3hQYXJ0cyBvbiBKU09OQm94IHtcbiAgdmFsdWVcbiAgX190eXBlbmFtZVxufVxuXG5mcmFnbWVudCBGaWxlUGFydHMgb24gRmlsZSB7XG4gIGlkXG4gIGZpbGVuYW1lXG4gIF9fdHlwZW5hbWVcbn1cblxuZnJhZ21lbnQgRm9ybUZpZWxkRW50cnlQYXJ0cyBvbiBGb3JtRmllbGRFbnRyeSB7XG4gIGlkXG4gIGZpZWxkXG4gIGZpZWxkVmFsdWUge1xuICAgIC4uLiBvbiBKU09OQm94IHtcbiAgICAgIC4uLkpTT05Cb3hQYXJ0c1xuICAgICAgX190eXBlbmFtZVxuICAgIH1cbiAgICAuLi4gb24gRmlsZSB7XG4gICAgICAuLi5GaWxlUGFydHNcbiAgICAgIF9fdHlwZW5hbWVcbiAgICB9XG4gICAgLi4uIG9uIEZpbGVMaXN0IHtcbiAgICAgIGZpbGVzIHtcbiAgICAgICAgLi4uRmlsZVBhcnRzXG4gICAgICAgIF9fdHlwZW5hbWVcbiAgICAgIH1cbiAgICAgIF9fdHlwZW5hbWVcbiAgICB9XG4gICAgX190eXBlbmFtZVxuICB9XG4gIGlzUmVxdWlyZWRcbiAgZGVzY3JpcHRpb25IdG1sXG4gIGlzSGlkZGVuXG4gIF9fdHlwZW5hbWVcbn1cblxuZnJhZ21lbnQgRm9ybVJlbmRlclBhcnRzIG9uIEZvcm1SZW5kZXIge1xuICBpZFxuICBmb3JtQ29udHJvbHMge1xuICAgIGlkZW50aWZpZXJcbiAgICB0aXRsZVxuICAgIF9fdHlwZW5hbWVcbiAgfVxuICBlcnJvck1lc3NhZ2VzXG4gIGZvcm1FcnJvcnMge1xuICAgIG1lc3NhZ2VcbiAgICBmaWVsZEVudHJ5SWRcbiAgICBfX3R5cGVuYW1lXG4gIH1cbiAgc2VjdGlvbnMge1xuICAgIHRpdGxlXG4gICAgZGVzY3JpcHRpb25IdG1sXG4gICAgZmllbGRFbnRyaWVzIHtcbiAgICAgIC4uLkZvcm1GaWVsZEVudHJ5UGFydHNcbiAgICAgIF9fdHlwZW5hbWVcbiAgICB9XG4gICAgaXNIaWRkZW5cbiAgICBfX3R5cGVuYW1lXG4gIH1cbiAgc291cmNlRm9ybURlZmluaXRpb25JZFxuICBfX3R5cGVuYW1lXG59XG5cbmZyYWdtZW50IFNvdXJjaW5nRm9ybVdpdGhGb3JtUmVuZGVyUGFydHMgb24gU291cmNpbmdGb3JtV2l0aEZvcm1SZW5kZXIge1xuICBpZFxuICBvcmdhbml6YXRpb25JZFxuICBzb3VyY2luZ0Zvcm1SZW5kZXIge1xuICAgIC4uLiBvbiBGb3JtUmVuZGVyIHtcbiAgICAgIC4uLkZvcm1SZW5kZXJQYXJ0c1xuICAgICAgX190eXBlbmFtZVxuICAgIH1cbiAgICBfX3R5cGVuYW1lXG4gIH1cbiAgcHVibGljVGl0bGVcbiAgZGVzY3JpcHRpb25IZWFkZXJIdG1sXG4gIGRlc2NyaXB0aW9uRm9vdGVySHRtbFxuICBzdWJtaXNzaW9uU3VjY2Vzc01lc3NhZ2VIdG1sXG4gIHN1Ym1pdEJ1dHRvblRleHRcbiAgc2hvd0F1dG9maWxsQm94XG4gIG9yZ2FuaXphdGlvbkJyYW5kIHtcbiAgICBob3N0ZWRKb2JzUGFnZVNsdWdcbiAgICBfX3R5cGVuYW1lXG4gIH1cbiAgX190eXBlbmFtZVxufVxuIn0K';
const BASELINE_SHA256 = '5f3d2a629d35c05d6f08e9bcd0f2450aa38e634a7436fffbc1f49e5b8e47320f';
const REQUEST_SHA256 = '26301b880ec3355a303c0431fa61fdc78c804d4d3964711771061c44876e51a8';
const URL = 'https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiSourcingForm';
const MAX_BODY = 4 * 1024 * 1024;
const ROOT = '/data/sourcingForm/sourcingFormRender';
const PATHS = [`${ROOT}/id`, `${ROOT}/formControls/0/identifier`,
  ...Array.from({ length: 10 }, (_, i) => `${ROOT}/sections/0/fieldEntries/${i}/id`)];
const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const nativeLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'length').get;
const nativeByteLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteLength').get;
const nativeBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'buffer').get;
const nativeSet = typedArrayPrototype.set;
const nativeResizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

function hold(gate, message) {
  const error = new Error(`Hyperscience form comparison: ${message}`);
  error.code = 'HYPERSCIENCE_FORM_COMPARISON_HOLD';
  error.gate = gate;
  throw error;
}

function objectDescriptors(value) {
  if (!value || typeof value !== 'object' || types.isProxy(value)) hold('ownership', 'Plain own-data object required');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) hold('ownership', 'Unreviewed object prototype');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string')) hold('ownership', 'Symbol data is unreviewed');
  for (const descriptor of Object.values(descriptors)) {
    if (!Object.hasOwn(descriptor, 'value')) hold('ownership', 'Accessors are unreviewed');
  }
  return descriptors;
}

function exactFields(value, fields) {
  const descriptors = objectDescriptors(value);
  const names = Object.keys(descriptors);
  if (names.length !== fields.length || names.some(name => !fields.includes(name))) hold('ownership', 'Exact raw input shape required');
  return Object.fromEntries(names.map(name => [name, descriptors[name].value]));
}

function plainSnapshot(value, ancestors = new Set(), budget = { count: 0 }, depth = 0) {
  if (++budget.count > 50000 || depth > 64) hold('ownership', 'Metadata bounds exceeded');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return value;
  if (!value || typeof value !== 'object' || types.isProxy(value) || ancestors.has(value)) hold('ownership', 'Plain acyclic JSON metadata required');
  ancestors.add(value);
  let result;
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) hold('ownership', 'Unreviewed array prototype');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const length = descriptors.length.value;
    if (length > 50000 || Reflect.ownKeys(descriptors).length !== length + 1) hold('ownership', 'Dense bounded array required');
    result = [];
    for (let i = 0; i < length; i++) {
      const descriptor = descriptors[i];
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) hold('ownership', 'Array accessors/holes are unreviewed');
      result.push(plainSnapshot(descriptor.value, ancestors, budget, depth + 1));
    }
  } else {
    const descriptors = objectDescriptors(value);
    result = {};
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (key === 'toJSON') hold('ownership', 'Serialization hooks are unreviewed');
      Object.defineProperty(result, key, { value: plainSnapshot(descriptor.value, ancestors, budget, depth + 1),
        enumerable: true, writable: true, configurable: true });
    }
  }
  ancestors.delete(value);
  return result;
}

function privateBytes(value) {
  if (!value || types.isProxy(value) || !types.isUint8Array(value)) hold('ownership', 'Original Buffer/Uint8Array required');
  let length, byteLength, buffer;
  try {
    length = nativeLength.call(value);
    byteLength = nativeByteLength.call(value);
    buffer = nativeBuffer.call(value);
  } catch { hold('ownership', 'Invalid native byte view'); }
  if (!length || length !== byteLength || length > MAX_BODY || types.isSharedArrayBuffer(buffer)) hold('ownership', 'Byte size/shared-memory bound');
  if (nativeResizable?.call(buffer)) hold('ownership', 'Resizable byte storage is unreviewed');
  // Numeric indexed properties belong to the native view. Reject all custom
  // own hooks without reading their values; no conversion/getter/species call.
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(key) || Number(key) >= length) hold('ownership', 'Custom byte properties are unreviewed');
  }
  const copy = new Uint8Array(length);
  try { nativeSet.call(copy, value, 0); }
  catch { hold('ownership', 'Native byte snapshot failed'); }
  return Buffer.from(nativeBuffer.call(copy));
}

// Bounded byte-indexed JSON parsing retains semantic paths and original UTF8
// string token spans. JSON.parse is used only on individual already-delimited
// string tokens; duplicate semantic keys are checked before object assignment.
function parseOriginal(bytes) {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) hold('utf8', 'BOM is unreviewed');
  try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { hold('utf8', 'Strict UTF8 required'); }
  let at = 0;
  let count = 0;
  const strings = new Map();
  const token = () => { if (++count > 50000) hold('json-tokens', 'JSON lexical token bound exceeded'); };
  const whitespace = () => { while ([9, 10, 13, 32].includes(bytes[at])) at++; };
  const punctuation = expected => {
    whitespace();
    if (bytes[at] !== expected) hold('json-syntax', 'Unexpected JSON punctuation');
    token(); at++;
  };
  const string = path => {
    whitespace(); token();
    const start = at;
    if (bytes[at++] !== 34) hold('json-syntax', 'JSON string required');
    let ended = false;
    while (at < bytes.length) {
      const character = bytes[at++];
      if (character === 92) { at++; continue; }
      if (character === 34) { ended = true; break; }
    }
    if (!ended) hold('json-syntax', 'Unterminated JSON string');
    const rawToken = bytes.subarray(start, at).toString('utf8');
    let value;
    try { value = JSON.parse(rawToken); }
    catch { hold('json-syntax', 'Invalid JSON string'); }
    if (path !== null) strings.set(path, { path, value, byteStart: start, byteEndExclusive: at, rawToken });
    return value;
  };
  const pathKey = key => key.replaceAll('~', '~0').replaceAll('/', '~1');
  function value(path, depth) {
    if (depth > 64) hold('json-depth', 'JSON depth bound exceeded');
    whitespace();
    const character = bytes[at];
    if (character === 34) return string(path);
    if (character === 123) {
      punctuation(123);
      const result = {};
      const keys = new Set();
      whitespace();
      if (bytes[at] === 125) { punctuation(125); return result; }
      while (true) {
        const key = string(null);
        if (keys.has(key)) hold('json-duplicate', 'Duplicate semantic JSON key');
        keys.add(key);
        punctuation(58);
        const child = value(`${path}/${pathKey(key)}`, depth + 1);
        Object.defineProperty(result, key, { value: child, enumerable: true, writable: true, configurable: true });
        whitespace();
        if (bytes[at] === 125) { punctuation(125); return result; }
        punctuation(44);
      }
    }
    if (character === 91) {
      punctuation(91);
      const result = [];
      whitespace();
      if (bytes[at] === 93) { punctuation(93); return result; }
      while (true) {
        result.push(value(`${path}/${result.length}`, depth + 1));
        whitespace();
        if (bytes[at] === 93) { punctuation(93); return result; }
        punctuation(44);
      }
    }
    token();
    for (const [literal, parsed] of [['null', null], ['true', true], ['false', false]]) {
      if (bytes.subarray(at, at + literal.length).toString('ascii') === literal) { at += literal.length; return parsed; }
    }
    const start = at;
    while (at < bytes.length && /[0-9eE+.-]/.test(String.fromCharCode(bytes[at]))) at++;
    const raw = bytes.subarray(start, at).toString('ascii');
    if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(raw) || !Number.isFinite(Number(raw))) hold('json-syntax', 'Invalid JSON value');
    return Number(raw);
  }
  const model = value('', 1);
  whitespace();
  if (at !== bytes.length) hold('json-syntax', 'Trailing bytes are unreviewed');
  return { model, strings };
}

const baselineBytes = Buffer.from(BASELINE_BASE64, 'base64');
const requestBytes = Buffer.from(REQUEST_BASE64, 'base64');
if (sha(baselineBytes) !== BASELINE_SHA256 || sha(requestBytes) !== REQUEST_SHA256) throw new Error('Invalid internal original baseline');
const baseline = parseOriginal(baselineBytes);
const baselineForm = baseline.model.data.sourcingForm;
const baselineRender = baselineForm.sourcingFormRender;
const baselineEntries = baselineRender.sections[0].fieldEntries;
const baselineTokens = PATHS.map(path => baseline.strings.get(path));
const protectedIds = new Set([baselineForm.id, baselineForm.organizationId, baselineRender.sourceFormDefinitionId,
  ...baselineEntries.flatMap(entry => [entry.field.id, entry.field.path])]);

const FIXED_HEADERS = {
  'access-control-allow-origin': '*',
  'alt-svc': 'h3=":443"; ma=86400',
  'ashby-session-expiry-alert-level': '',
  'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'cf-cache-status': 'DYNAMIC',
  'connection': 'keep-alive',
  'content-encoding': 'br',
  'content-type': 'application/json; charset=utf-8',
  'referrer-policy': 'same-origin',
  'server': 'cloudflare',
  'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
  'transfer-encoding': 'chunked',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};
const HEADER_NAMES = [...Object.keys(FIXED_HEADERS), 'cf-ray', 'date', 'x-ashby-request-id'].sort();
const REQUEST_HEADERS = { 'Content-Type': 'application/json', Accept: '*/*', 'Cache-Control': 'no-store', Pragma: 'no-cache' };

function initialSecurity(receipt) {
  const headers = receipt.headers;
  if (!headers || Array.isArray(headers) || !Array.isArray(receipt.headerEntries)) hold('security', 'Actual original header map and entries required');
  if (!isDeepStrictEqual(Object.keys(headers).sort(), HEADER_NAMES)) hold('security', 'Unknown or missing original header');
  const entries = {};
  for (const entry of receipt.headerEntries) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || typeof entry[1] !== 'string' || Object.hasOwn(entries, entry[0])) hold('security', 'Unique actual header entries required');
    Object.defineProperty(entries, entry[0], { value: entry[1], enumerable: true });
  }
  if (!isDeepStrictEqual(headers, entries) || (Object.hasOwn(receipt, 'responseHeaders') && !isDeepStrictEqual(receipt.responseHeaders, headers))) hold('security', 'Header views disagree');
  for (const [key, expected] of Object.entries(FIXED_HEADERS)) {
    if (headers[key] !== expected) hold('security', 'Unreviewed initial Q policy/MIME');
  }
  if (!/^[0-9a-f]{16}-[A-Z]{3}$/.test(headers['cf-ray']) || !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(headers['x-ashby-request-id'])) hold('security', 'Unreviewed operational header representation');
  if (typeof headers.date !== 'string' || !Number.isFinite(Date.parse(headers.date)) || new Date(headers.date).toUTCString() !== headers.date) hold('security', 'Original HTTP Date representation required');
  return { ...FIXED_HEADERS };
}

function readSnapshot(record) {
  const own = exactFields(record, ['body', 'receipt']);
  const bytes = privateBytes(own.body);
  const receipt = plainSnapshot(own.receipt);
  if (!receipt || Array.isArray(receipt)) hold('ownership', 'Plain original receipt required');
  if (receipt.requestedURL !== URL || receipt.finalURL !== URL || receipt.method !== 'POST' || receipt.status !== 200 ||
    receipt.bodyComplete !== true || receipt.streamDone !== true || receipt.decodedPrefixOnly !== false ||
    receipt.bodyBytes !== bytes.length || receipt.bodySHA256 !== sha(bytes) ||
    receipt.requestBodyBytes !== requestBytes.length || receipt.requestBodySHA256 !== REQUEST_SHA256 ||
    receipt.cache !== 'no-store' || receipt.credentials !== 'omit' || receipt.redirect !== 'manual' ||
    !isDeepStrictEqual(receipt.requestHeaders, REQUEST_HEADERS) ||
    (Object.hasOwn(receipt, 'error') && receipt.error !== null)) hold('transport', 'Complete exact original request/response provenance required');
  for (const key of ['suppliedCookieOrAuthOrSessionData', 'suppliedCandidateOrApplicationIdentifiers', 'suppliedFieldValues', 'formSubmission', 'mutation', 'publisherJavaScriptExecuted']) {
    if (Object.hasOwn(receipt, key) && receipt[key] !== false) hold('transport', 'Unreviewed supplied input/execution metadata');
  }
  for (const key of ['requestedAt', 'responseAt', 'completedAt']) {
    if (typeof receipt[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(receipt[key]) ||
      !Number.isFinite(Date.parse(receipt[key])) || new Date(receipt[key]).toISOString() !== receipt[key]) hold('transport', 'Original request/response/completion clocks required');
  }
  const start = Date.parse(receipt.requestedAt), response = Date.parse(receipt.responseAt), end = Date.parse(receipt.completedAt);
  if (response < start || end < response || end - start > 20000) hold('transport', 'Individual complete-response bounds required');
  const security = initialSecurity(receipt);
  const parsed = parseOriginal(bytes);
  const tokens = PATHS.map(path => parsed.strings.get(path));
  if (tokens.some(token => !token)) hold('slots', 'Exactly twelve semantic string value paths required');
  for (const token of tokens.slice(0, 2)) {
    if (!UUID4.test(token.value) || token.rawToken !== `"${token.value}"`) hold('uuid', 'Unescaped canonical independent UUIDv4 required');
  }
  const [renderId, actionIdentifier] = tokens.slice(0, 2).map(token => token.value);
  if (renderId === actionIdentifier || protectedIds.has(renderId) || protectedIds.has(actionIdentifier)) hold('identity', 'Interactive/stable identities must remain distinct');
  const modelForm = parsed.model?.data?.sourcingForm;
  const modelRender = modelForm?.sourcingFormRender;
  const modelEntries = modelRender?.sections?.[0]?.fieldEntries;
  if (modelForm.id !== baselineForm.id || modelForm.organizationId !== baselineForm.organizationId ||
    modelRender.sourceFormDefinitionId !== baselineRender.sourceFormDefinitionId || !Array.isArray(modelEntries)) hold('identity', 'Stable form/org/source identities changed');
  const ids = new Set();
  for (let i = 0; i < 10; i++) {
    const entry = modelEntries[i];
    if (entry?.field?.id !== baselineEntries[i].field.id || entry?.field?.path !== baselineEntries[i].field.path) hold('identity', 'Stable native field IDs/paths/order changed');
    const token = tokens[i + 2];
    const expected = `${renderId}_${entry.field.path}`;
    if (token.value !== expected || token.rawToken !== `"${expected}"` || ids.has(token.value)) hold('binding', 'Full own-render/native-path entry binding required');
    ids.add(token.value);
  }
  let previous = 0;
  const complements = [];
  for (let i = 0; i <= tokens.length; i++) {
    const token = tokens[i];
    const end = token ? token.byteStart : bytes.length;
    const expectedEnd = baselineTokens[i]?.byteStart ?? baselineBytes.length;
    if ((token && (token.byteStart !== baselineTokens[i].byteStart || token.byteEndExclusive !== baselineTokens[i].byteEndExclusive)) ||
      end !== expectedEnd || !bytes.subarray(previous, end).equals(baselineBytes.subarray(previous, expectedEnd))) hold('baseline', 'Unknown non-slot raw model/schema/criteria/layout');
    const part = bytes.subarray(previous, end);
    complements.push({ byteStart: previous, byteEndExclusive: end, bytes: part.length, sha256: sha(part) });
    if (token) previous = token.byteEndExclusive;
  }
  return { bytes, evidence: { receipt, bodyBytes: bytes.length, bodySHA256: sha(bytes), bodyBase64: bytes.toString('base64'),
    model: parsed.model, tokens, complements, identifiers: { renderId, actionIdentifier, entryIds: [...ids] },
    independentKnownBaselineQualified: true, completeOriginalEntityRetained: true, security }, security };
}

/** Pure comparison of the reviewed server-published definition/criteria only.
 * Raw bodies/IDs remain separate. No currentness, interactive or country claim.
 * opening/closing each contain {body: Buffer|Uint8Array, receipt: plain JSON}.
 */
export function compareHyperscienceServerFormCriteria(options) {
  const own = exactFields(options, ['opening', 'closing', 'requestBody']);
  const request = privateBytes(own.requestBody);
  if (!request.equals(requestBytes)) hold('request', 'Exact frozen1983B public definition query required');
  const opening = readSnapshot(own.opening);
  const closing = readSnapshot(own.closing);
  // Each complement already independently equals the same pinned original.
  if (!isDeepStrictEqual(opening.evidence.complements, closing.evidence.complements) || !isDeepStrictEqual(opening.security, closing.security)) hold('baseline', 'Independent complementary source facts disagree');
  return {
    source: 'hyperscience', comparisonProfile: 'hyperscience-server-form-criteria-v2',
    rawEntityEqual: opening.bytes.equals(closing.bytes), serverDefinitionCriteriaEqual: true,
    rawHeaderViewsEqual: isDeepStrictEqual(opening.evidence.receipt.headers, closing.evidence.receipt.headers) &&
      isDeepStrictEqual(opening.evidence.receipt.headerEntries, closing.evidence.receipt.headerEntries),
    securityProfileEqual: true,
    scope: 'comparison-only-server-purpose-definition-criteria',
    baseline: { bodySHA256: BASELINE_SHA256, bodyBytes: baselineBytes.length, variableSemanticStringTokens: 12,
      fixedComplementBytes: 7633, fullKnownNonSlotModelQualified: true },
    request: { bodyBase64: request.toString('base64'), bodyBytes: request.length, bodySHA256: sha(request) },
    opening: opening.evidence, closing: closing.evidence,
    interactiveIdentityQualified: false, actionValidityOrInterchangeabilityQualified: false,
    UIOrApplicationEquivalent: false, sideEffectFreeInitializationQualified: false,
    sourceTimeSemanticsQualified: false, workCountry: null, applicantCountry: null,
    programmeOrCurrentnessQualified: false, globalScopeQualified: false, lifecycleCleanupAllowed: false,
    limits: [
      'Only the exact known server purpose/definition/criteria with twelve typed semantic token values may compare.',
      'render.id also feeds IF; full render feeds R9 and full entries feed xJ. Action/render/form IDs feed submit.',
      'Interactive/render/action/UI/application/screening identity or equivalence is unqualified.',
      'Historical separately clocked inputs do not establish a coherent interval, source time, programme or country.',
    ],
  };
}
