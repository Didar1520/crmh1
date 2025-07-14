# CRM Automation

This repository contains scripts for synchronizing orders and other utilities.

## Environment Variables

Certain scripts require the following variables:

- **`CRM_ROOT`** – Absolute path to the project directory. Used for locating
  `data` and `logs` folders. If not set, scripts default to the repository root.
- **`PORT`** – Port number for the Express server. Defaults to `8080`.
- **`NO_COLOR`** – When set, disables colored console output (optional).

Example usage:

```bash
CRM_ROOT="D:\\Didar1520\\CRM" PORT=3000 node server.js
```
