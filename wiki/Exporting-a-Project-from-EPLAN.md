# Exporting a Project from EPLAN

The viewer opens the **Smart Production** publication of an EPLAN project — a
single `.epdz` file. You produce it from **EPLAN Electric P8 (2022 or newer)**.
There are two ways.

## Option A — From the EPLAN UI

1. Open your project in EPLAN Electric P8.
2. Go to **File → Publish**.
3. Choose **Smart Production Collection**.
4. Pick an output folder and confirm.

EPLAN writes a `.epdz` file to that folder. Drag it into the viewer — done.

## Option B — By script (repeatable / batch)

The repository ships a helper script that calls the exact same action the UI
uses:

1. In EPLAN, go to **Tools → Scripts → Load** and select
   [`tools/eplan/PublishEpdz.cs`](https://github.com/covagashi/ecad-view/blob/main/tools/eplan/PublishEpdz.cs).
2. Edit the two path constants at the top of the script — the project `.elk`
   file and the output folder.
3. Run the script. It invokes the `projectmanagement`
   `PUBLISHSMARTPRODUCTION` action, so the result is identical to the UI export.

## What's inside a `.epdz`?

The export contains only what EPLAN publishes:

- **Schematic pages** — the SVG pages of the project.
- **3D installation spaces** — the E3D models.
- **`manifest.db`** — a SQLite database with the project structure and metadata.

> **Report pages** (parts lists / BOM, terminal diagrams, cable plans…) are
> included **only if** they were already generated as pages in the project
> *before* publishing. If you want them in the viewer, generate them first.

For the low-level details of the formats, see the
[file-format notes](https://github.com/covagashi/ecad-view/blob/main/docs/formats.md).
