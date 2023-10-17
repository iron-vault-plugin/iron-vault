---
forged: dataforged-inline
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
            "Result": "[[⏵Action](starforged/oracles/core/action)] [[⏵Theme](starforged/oracles/core/theme)]"
            "Roll template":
              "$id": "starforgedsupp/oracles/templates/actiontheme/1-100/roll_template"
              "Result": "{{starforged/oracles/core/action}} {{starforged/oracles/core/theme}}"
```