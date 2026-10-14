# Two-person pet home

Every visit to the pet page asks the visitor to choose 男方 or 女方. Both roles open the same existing GitHub save through `GET /api/couple/home`; no invitation, room-code or nickname workflow is required. A saved role only highlights the last choice, and does not bypass the entry screen.

`partner-male` and `partner-female` are stable actor IDs across browsers and devices. The server enforces their names for the common home, while keeping other legacy room APIs compatible. Pending actions are stored separately per role and retain their operation IDs until the GitHub commit is acknowledged. Switching identity during an in-flight save waits for completion.

The existing home is `0aed6937627c924a7497025ebd18fe5d`. `COUPLE_ROOM_ID` can point to another existing save if explicitly configured. Missing, inaccessible or corrupt saves report a connection error and never create a replacement. Existing progress and diary entries remain intact. Roles describe who is caring for the pet and are not login credentials.

The local preview without `VITE_API_URL` retains browser-local progress. The GitHub Pages build uses the configured API URL to read and save the shared cloud home.
