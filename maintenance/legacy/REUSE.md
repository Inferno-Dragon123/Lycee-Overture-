# Reused first-generation maintenance code

The project owner requested migration of the complete first-generation automation.
These selected scripts and their code dependencies come from the owner's
`Inferno-Dragon123/lycee-toolbox` checkout `05d1da3941331b332f51868e710fdf7274dd1fba`.
The image mirror and local auth code come from the existing Tencent migration
checkout `41a06f1b3f34e63d5051fa2beb64fd06924b298c`.

Only code is versioned here. Runtime catalogs, crawl caches and translations live
in the Tencent maintenance workspace. The database uses local PostgreSQL; the
Vercel pool hook and Git push step are not used. Credentials are supplied by root
private systemd environment files, never copied into this directory.

Tencent download handling was adjusted on 2026-10-29: smaller fixed card pages,
checkpoint page-size validation, bounded empty-response retries and a longer
deck-request deadline with backoff. Evidence and limits are recorded in
`docs/design/official-crawler-diagnosis-20261029.md` at the project root. This is
an adaptation of the cited baseline, not an unchanged upstream copy.
