# TF-01: Organization-scoped project access

Status: proposed; initial MVP approval pending. Product requirements, not implementation evidence.

## User outcome

A signed-in user can create an organization and work with its projects without seeing or changing another organization's data. An owner controls membership roles.

## MVP boundary

Authentication/sign-out, organizations, membership in multiple organizations, organization switcher, owner-managed membership for already registered users, project list/create/edit/archive and role enforcement. Roles are owner, admin, member and viewer. Billing, SSO, email invitations, granular custom permissions, tasks/chat and audit-log UI are excluded.

## Permission matrix

| Action | Owner | Admin | Member | Viewer |
| --- | --- | --- | --- | --- |
| Read organization/projects | yes | yes | yes | yes |
| Create/edit/archive projects | yes | yes | yes | no |
| Manage existing-user memberships/roles | yes | no | no | no |
| Rename organization | yes | yes | no | no |

The last owner cannot be removed or demoted. Membership changes apply on the next request. Removing organization membership revokes access to that organization's projects.

## Acceptance criteria

- TF-A01: a request without a valid session returns 401 for protected endpoints; sign-out invalidates the local session.
- TF-A02: creating an organization atomically gives the creator owner membership; failure leaves neither a partial organization nor an orphan membership.
- TF-A03: lists include only organizations/projects accessible to the current user; switching organizations shows no stale cached records from the previous selection.
- TF-A04: direct reads and mutations of another tenant's project return 404 with no data change; guessed IDs and forged tenant headers cannot override membership checks.
- TF-A05: a viewer reads but receives 403 for mutations inside an organization they can access. Member/admin/owner mutations follow the matrix.
- TF-A06: project persistence survives an API restart; invalid names are rejected. Names must be trimmed, 1–120 characters. Archive hides a project from the default list but does not delete it.
- TF-A07: duplicate memberships are rejected; removing/demoting the last owner fails even with concurrent requests.
- TF-A08: membership revocation takes effect on the next request; cross-tenant relationship IDs cannot link a project to another tenant's records.
- TF-A09: a browser scenario demonstrates sign-in → organization → create project → switch organization → no leakage; UI shows loading, empty, forbidden and error states accessibly.

## First validation slice

TF-00 chooses and verifies identity integration. TF-01 then implements sign-in, two-tenant fixtures, create/list projects, and TF-A01 through TF-A05/TF-A09 for those operations. Full membership management and archive remain follow-up tasks. This narrow slice validates the workflow on real authorization behavior.

## Initial proposal requiring review

The role matrix, name limit and membership-without-email scope are proposed defaults. Identity provider remains an explicit TF-00 decision, not an assumption hidden in implementation.
