# Core patch intake canonical evidence

Main4405b5c6 accepted the published Core0.13.3 development dependency and
registry override through PR35. Its main CI43704372870 stopped at specification
checking: the manifest/lock changes lacked their two mapped canonical chapters.
The upstream package and Notebook runtime were not established as defective.

The exact source regression was
`pnpm exec spec-validator first --base 1e2f0f84 --head 4405b5c6`:
two `SPEC-FIRST-MISSING` findings under LPN-SPEC-002. The owning Notebook index
and governance chapter now describe the development intake and retain public
peer support, runtime registration, execution, persistence and release gates.
The same base-to-current gate passes with3 protected files and2 canonical
chapters. No specification exemption or functional gate changes.

The default Docker `pnpm spec:check` passed all3 specification lanes, routing
and catalog parity checks and the App-ownership test. QMD index/search wiring
is retained; doctor reports10 passes and the existing wrapper-alias warning.
The two changed chapters use the existing pinned Prettier3.7.4 formatter from
the coordinator workspace, without adding a Notebook dependency. Full hosted
quality and aggregate acceptance remain required on the actual repair PR.

A historical local validation run had exited130 with no result.json and retained
its checkout lease. Its partial reports/archive/log and the cancelled worker were
preserved; an external termination observation verified the exact owned run had
finished and no owned worker was active before releasing only its empty lease.
No stopped worker, report, shared volume or other checkout was deleted. The
default Docker check then ran successfully; no host fallback was used.
