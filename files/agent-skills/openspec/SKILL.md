---
name: openspec
description: Use when planning or implementing a change with OpenSpec, including checking a change's status, applying its tasks, or validating its artifacts.
---

# OpenSpec

Use the OpenSpec artifacts as the plan and source of truth for the change.

## Artifact flow

For the default `spec-driven` schema, create these artifacts:

```text
1. proposal
2. specs and design
3. tasks
4. implementation
```

`specs` and `design` depend on `proposal`. `tasks` depends on both `specs` and `design`.

- `proposal`: capture the intent, scope, and high-level approach.
- `specs`: define the behavior, requirements, and scenarios. Describe brownfield changes as `ADDED`, `MODIFIED`, or `REMOVED` deltas.
- `design`: describe the technical approach and important implementation decisions.
- `tasks`: turn the agreed proposal, specs, and design into a concrete implementation checklist.

Do not start implementation merely because `proposal`, `specs`, `design`, and `tasks` are present. All four must be coherent, and the user must explicitly request implementation. The workflow is iterative, so update the artifacts when implementation changes the understanding of the work.

## Creating artifacts

Use the CLI instructions to create artifacts one at a time. The artifact name is required; pass it explicitly when requesting instructions.

```sh
openspec instructions proposal --change <change>
openspec instructions specs --change <change>
openspec instructions design --change <change>
openspec instructions tasks --change <change>
```

Read the returned instructions and existing dependencies before creating or editing each artifact. Recheck `openspec status --change <change>` after each artifact. Once `tasks` is complete, report that the plan is ready and wait for the user's explicit implementation request. Only then use `openspec instructions apply --change <change>` to guide implementation.

- If `openspec/` is missing, ask the user for confirmation before running `openspec init --tools none`; never initialize it automatically.
- Before editing, inspect the active change with `openspec list` and `openspec status --change <change>`.
- Keep the tasks and artifacts up to date while working.
- Run `openspec validate <change>` after implementation.

## Revising a change

When correcting an existing change, do not recreate its artifacts. First inspect `openspec list` and `openspec status --change <change>`, then read the artifact being changed and its dependencies.

- Before editing an existing artifact, get its artifact-specific instructions:

  ```sh
  openspec instructions proposal --change <change>
  openspec instructions specs --change <change>
  openspec instructions design --change <change>
  openspec instructions tasks --change <change>
  ```

  Request only the artifact being revised. The CLI's output may say `Create` even when the artifact already exists; use it for format, dependency, and validation guidance, then update the existing file in place.
- Update the artifact that no longer reflects the requested behavior or approach.
- If `proposal` changes, review `specs`, `design`, and `tasks`.
- If `specs` or `design` changes, review `tasks` and update its checklist.
- Update the active change's delta specs under `openspec/changes/<change>/specs/`; do not edit the main specs directly.
- For spec deltas, use `ADDED`, `MODIFIED`, or `REMOVED`. A `MODIFIED` requirement must keep the existing requirement name and include its complete updated text and scenarios; do not rewrite the entire main spec.
- Keep `tasks.md` as a living checklist. Preserve completed tasks as `[x]`, and add only the unchecked implementation, test, or documentation tasks required by the revised delta. Do not regenerate or reset the whole task list.
- If the requested spec now matches code that is already implemented, update the delta to describe the shipped behavior and keep the related tasks complete; do not invent new implementation tasks.
- If the requested spec requires behavior not yet implemented, add the remaining tasks as unchecked. If the user has already explicitly requested implementation for this change (for example, by saying `apply`), continue implementing those tasks; otherwise wait for an explicit implementation request.
- Keep implementation and task progress consistent with the artifacts.
- Recheck `openspec status --change <change>` after the revision and run `openspec validate <change>` before implementation or archiving.

## Archiving

Archive a change only when the user explicitly asks for it; never infer an archive request from implementation completion. After implementation is complete and validation passes, run:

```sh
openspec validate <change>
openspec archive <change>
```

Review the archive confirmation before proceeding.
