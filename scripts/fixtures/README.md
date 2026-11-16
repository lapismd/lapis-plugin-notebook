# Immutable Core intake test data

`core-intake.json.gz` holds public Notebook PR36 input snapshots at the recorded
source and candidate revisions (Core0.13.3 to0.13.4). It is data only and is never
installed, executed, fetched by normal checks or used as production fallback.
The Notebook tests verify their own domain adapter independently from the shared
coordinator renderer, including the real pnpm peer-context closure.
