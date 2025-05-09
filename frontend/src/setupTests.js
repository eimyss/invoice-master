// frontend/src/setupTests.js
import "@testing-library/jest-dom";
import { server } from "./mocks/server.js"; // Import the msw server
import { resetMockClients } from "./mocks/handlers.js"; // Import reset function
import {
  beforeAll,
  afterAll,
  afterEach,
  expect,
  vi,
  describe,
  it,
  beforeEach,
} from "vitest";
import "./App.css";
import "./calendar-dark.css";
import "./datepicker-dark.css";

import { debug } from "vitest-preview";
// Establish API mocking before all tests.
beforeAll(() => server.listen({ onUnhandledRequest: "error" })); // Error on unhandled requests

// Reset any request handlers and mock data that we may add during the tests,
// so they don't affect other tests.
afterEach(async (context) => {
  if (
    context &&
    context.task &&
    context.task.result &&
    context.task.result.state === "fail"
  ) {
    // Call preview here on failure
    debug(); // This will open the browser with the current DOM state
    // Or you can pass specific elements:
    // if (document.body.firstChild) {
    //    preview(document.body.firstChild);
    // }
  }
  // MSW reset
  server.resetHandlers();
  resetMockClients();
});
// Clean up after the tests are finished.
afterAll(() => server.close());
