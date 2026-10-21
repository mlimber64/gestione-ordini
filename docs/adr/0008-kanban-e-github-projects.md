# ADR 0008: Kanban su GitHub Projects

- Stato: accettata
- Data: 2026-10-21

## Contesto

Il progetto è portato avanti da una sola persona. Le cerimonie di Scrum (planning, daily, retrospettiva) presuppongono un team.

## Decisione

Usiamo **Kanban** con limite di lavoro in corso (WIP) pari a 2, su **GitHub Projects**. Le milestone di GitHub corrispondono alle release.

- Colonne: Backlog, Pronto, In corso, In revisione, Fatto.
- `main` è protetto: si entra solo con pull request.
- Conventional Commits, squash merge e versioni semantiche.

## Conseguenze

- Issue, commit e pull request restano collegati e visibili nel repository.
- Non c'è un calendario di sprint: l'avanzamento si legge dalle milestone.
