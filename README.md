# QuickNotes System Design

QuickNotes System Design is a small API client and backend design package for evolving a browser-only notes app into an online service. The client demonstrates GET, POST, and DELETE requests against JSONPlaceholder; the documentation describes a production-oriented REST API, relational data model, and scalable service architecture.

## Run the API client

1. Clone the repository and open a terminal in its root.
2. Serve the static files locally, for example:

   ```sh
   npx serve .
   ```

3. Open the local URL printed by the server.
4. Select **Load notes** to fetch sample posts, or use the form to try creating a note.

The API client requires an internet connection. JSONPlaceholder simulates POST and DELETE responses but does not persist changes, so newly created notes only appear in the current page session and loaded server data returns on the next GET.

## Design documents

- [REST API design](docs/api-design.md)
- [Data model](docs/data-model.md)
- [Architecture and scaling plan](docs/architecture.md)

## What I learned

- How a browser client sends asynchronous HTTP requests and handles loading, success, empty, and error states.
- How REST resources, ownership rules, status codes, and pagination can form a clear backend contract.
- How relational keys and a join table enforce ownership and many-to-many tag relationships.
- How read/write estimates, replicas, caching, queues, and redundancy shape a scalable architecture.
