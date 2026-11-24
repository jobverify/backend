// Semantic AST of the actual native getJobViewUrl serializer, not a whole-client fingerprint.
// Original source-owned Nov14 literal-declared-native-common-client SHA256: 89fbf5332cebc02bdf1fdfc0e9936c4bba377d4d82560d047af905d29f36ba10
export default {
  "type": "FunctionExpression",
  "id": null,
  "expression": false,
  "generator": false,
  "async": false,
  "params": [
    {
      "type": "Identifier",
      "name": "e"
    },
    {
      "type": "Identifier",
      "name": "t"
    },
    {
      "type": "Identifier",
      "name": "o"
    },
    {
      "type": "Identifier",
      "name": "a"
    }
  ],
  "body": {
    "type": "BlockStatement",
    "body": [
      {
        "type": "IfStatement",
        "test": {
          "type": "Identifier",
          "name": "a"
        },
        "consequent": {
          "type": "ReturnStatement",
          "argument": {
            "type": "BinaryExpression",
            "left": {
              "type": "BinaryExpression",
              "left": {
                "type": "MemberExpression",
                "object": {
                  "type": "Identifier",
                  "name": "o"
                },
                "property": {
                  "type": "Identifier",
                  "name": "internal_list_url"
                },
                "computed": false,
                "optional": false
              },
              "operator": "+",
              "right": {
                "type": "Literal",
                "value": "?id="
              }
            },
            "operator": "+",
            "right": {
              "type": "Identifier",
              "name": "e"
            }
          }
        },
        "alternate": null
      },
      {
        "type": "VariableDeclaration",
        "declarations": [
          {
            "type": "VariableDeclarator",
            "id": {
              "type": "Identifier",
              "name": "i"
            },
            "init": {
              "type": "CallExpression",
              "callee": {
                "type": "Identifier",
                "name": "encodeURIComponent"
              },
              "arguments": [
                {
                  "type": "CallExpression",
                  "callee": {
                    "type": "MemberExpression",
                    "object": {
                      "type": "Identifier",
                      "name": "t"
                    },
                    "property": {
                      "type": "Identifier",
                      "name": "replace"
                    },
                    "computed": false,
                    "optional": false
                  },
                  "arguments": [
                    {
                      "type": "Literal",
                      "value": {},
                      "regex": {
                        "pattern": "[\"\\~`!@#$%^&\\*\\(\\)=+\\[\\]\\{\\}\\|:;<>\\\\\\/,\\.\\?'\\s]+",
                        "flags": "g"
                      }
                    },
                    {
                      "type": "Literal",
                      "value": "-"
                    }
                  ],
                  "optional": false
                }
              ],
              "optional": false
            }
          },
          {
            "type": "VariableDeclarator",
            "id": {
              "type": "Identifier",
              "name": "r"
            },
            "init": {
              "type": "BinaryExpression",
              "left": {
                "type": "BinaryExpression",
                "left": {
                  "type": "BinaryExpression",
                  "left": {
                    "type": "BinaryExpression",
                    "left": {
                      "type": "ConditionalExpression",
                      "test": {
                        "type": "MemberExpression",
                        "object": {
                          "type": "Identifier",
                          "name": "o"
                        },
                        "property": {
                          "type": "Identifier",
                          "name": "external_url"
                        },
                        "computed": false,
                        "optional": false
                      },
                      "consequent": {
                        "type": "MemberExpression",
                        "object": {
                          "type": "Identifier",
                          "name": "o"
                        },
                        "property": {
                          "type": "Identifier",
                          "name": "external_url"
                        },
                        "computed": false,
                        "optional": false
                      },
                      "alternate": {
                        "type": "MemberExpression",
                        "object": {
                          "type": "Identifier",
                          "name": "o"
                        },
                        "property": {
                          "type": "Identifier",
                          "name": "list_url"
                        },
                        "computed": false,
                        "optional": false
                      }
                    },
                    "operator": "+",
                    "right": {
                      "type": "Literal",
                      "value": "/"
                    }
                  },
                  "operator": "+",
                  "right": {
                    "type": "Identifier",
                    "name": "e"
                  }
                },
                "operator": "+",
                "right": {
                  "type": "Literal",
                  "value": "/"
                }
              },
              "operator": "+",
              "right": {
                "type": "Identifier",
                "name": "i"
              }
            }
          }
        ],
        "kind": "var"
      },
      {
        "type": "ReturnStatement",
        "argument": {
          "type": "SequenceExpression",
          "expressions": [
            {
              "type": "LogicalExpression",
              "left": {
                "type": "MemberExpression",
                "object": {
                  "type": "Identifier",
                  "name": "o"
                },
                "property": {
                  "type": "Identifier",
                  "name": "source"
                },
                "computed": false,
                "optional": false
              },
              "operator": "&&",
              "right": {
                "type": "AssignmentExpression",
                "operator": "+=",
                "left": {
                  "type": "Identifier",
                  "name": "r"
                },
                "right": {
                  "type": "BinaryExpression",
                  "left": {
                    "type": "Literal",
                    "value": "?source="
                  },
                  "operator": "+",
                  "right": {
                    "type": "CallExpression",
                    "callee": {
                      "type": "Identifier",
                      "name": "encodeURIComponent"
                    },
                    "arguments": [
                      {
                        "type": "MemberExpression",
                        "object": {
                          "type": "Identifier",
                          "name": "o"
                        },
                        "property": {
                          "type": "Identifier",
                          "name": "source"
                        },
                        "computed": false,
                        "optional": false
                      }
                    ],
                    "optional": false
                  }
                }
              }
            },
            {
              "type": "Identifier",
              "name": "r"
            }
          ]
        }
      }
    ]
  }
}
