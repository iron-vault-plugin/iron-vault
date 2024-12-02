---
iron-vault-ignore: dataforged-inline
---
```dataforged
Oracle sets:
  Templates:
    "$id": starforgedsupp/oracles/templates
    Title:
      "$id": starforged/oracles/templates/title
      Canonical: Templates
      Standard: Templates
      Short: Templates
    Tables:
      "Action+Theme":
        "$id": starforgedsupp/oracles/templates/actiontheme
        Title:
          "$id": starforgedsupp/oracles/templates/actiontheme/title
          Canonical: Action+Theme
          Standard: Action+Theme
          Short: Action+Theme
        Ancestors:
          - starforgedsupp/oracles/templates
        Table:
          - Floor: 1
            Ceiling: 100
            "$id": "starforgedsupp/oracles/templates/actiontheme/1-100"
            "Result": "[[⏵Action](oracle_rollable:starforged/core/action)] [[⏵Theme](oracle_rollable:starforged/core/theme)]"
            "Roll template":
              "$id": "starforgedsupp/oracles/templates/actiontheme/1-100/roll_template"
              "Result": "{{oracle_rollable:starforged/core/action}} {{oracle_rollable:starforged/core/theme}}"
```
