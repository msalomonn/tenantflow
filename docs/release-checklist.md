# Release evidence — not yet satisfied

TF-04 maps all MVP acceptance criteria and verifies the local stack; see [verification](verification.md) and [dependency review](dependency-review.md). The items below must still be evaluated against the chosen release commit and deployment environment. A passing local/PR run does not by itself sign off this release.

- [ ] Every MVP acceptance ID maps to passing verification at the release commit.
- [ ] A fresh checkout can start the documented local stack.
- [ ] CI runs build, relevant tests and dependency analysis; findings are resolved or documented.
- [ ] Authentication, ownership/isolation and negative cases pass against real persistence.
- [ ] Production configuration excludes debug authentication and sensitive logs.
- [ ] Deployment/migrations and recovery steps are documented and rehearsed.
- [ ] Deployed smoke checks identify commit, environment, date and observed result.
- [ ] Public demo uses synthetic data and enforceable quotas/retention limits.
- [ ] README, architecture, ADRs, screenshots and limitations reflect actual behavior.
- [ ] Repository visibility, licensing and GitHub profile presentation are reviewed for publication.
