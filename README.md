# Screenshot and Tracking Utility

This repository includes a Node-based helper to collect order screenshots and save tracking numbers from iHerb. The tool reads configuration from `scripts/inputConfig.json` and processes each matching order.

## Generating the configuration

Use the helper script to create or update `inputConfig.json`:

```bash
node scripts/utils/generateCaptureConfig.js \
  --clients Karina \
  --from 01-07-2025 \
  --to 05-07-2025 \
  --tasks screenshot,trackSave
```

The command above produces a configuration similar to the example below.

## Example `inputConfig.json`

```json
[
  {
    "captureOrders": {
      "clients": ["Karina"],
      "range": { "type": "between", "from": "01-07-2025", "to": "05-07-2025" },
      "tasks": ["screenshot", "trackSave"]
    }
  }
]
```

- `clients` – filter orders by client names.
- `range` – limit processing to the specified date range (DD-MM-YYYY).
- `tasks` – enabled actions. `screenshot` stores PNGs under `logs/screens/<account>/`. `trackSave` records tracking numbers in `data/OrdersData/ordersData.json`.

## Running the utility

After generating the config, execute:

```bash
node scripts/actions/orderManager.js
```

The script reads `scripts/inputConfig.json`, launches a browser per account and performs the requested tasks. Progress is tracked in `data/OrdersData/shot_progress.json` to avoid repeating work.

