"use babel";

import { CompositeDisposable } from "atom";
import spawn from "cross-spawn";
import child_process from "child_process";
import path from "path";
import fs from "fs";

let subscriptions = null;
let initialized = false;
let isFailing = false;
let childProcess = null;

export function activate(state) {
  subscriptions = new CompositeDisposable();

  // TODO: Allow people to run the tests them through a command.
  // subscriptions.add(
  //   atom.commands.add("atom-workspace", {
  //     "atom-elm-test:run-tests": runTests
  //   })
  // );

  require("atom-package-deps")
    .install((packageName = "linter"), (showPrompt = true))
    .then(() => {
      initialized = true;
    });
}

export function deactivate() {
  subscriptions.dispose();
}

export function consumeIndie(registerIndie) {
  const linter = registerIndie({
    name: "Elm Test"
  });
  subscriptions.add(linter);

  // Setting and clearing messages per filePath
  subscriptions.add(
    atom.workspace.observeTextEditors(textEditor => {
      const editorPath = textEditor.getPath();
      // Consider supporting .elmx file (if anyone uses them)
      // or maybe look at the grammar instead of the file extension.
      if (!editorPath || !editorPath.endsWith(".elm")) {
        return;
      }

      subscriptions.add(
        textEditor.onDidSave(() => {
          runTests(linter, editorPath);
        })
      );

      const subscription = textEditor.onDidDestroy(() => {
        subscriptions.remove(subscription);
        linter.setMessages(editorPath, []);
      });

      subscriptions.add(subscription);
    })
  );

  // Clear all messages
  linter.clearMessages();
}

function guessFileForTest(editorPath, labels) {
  const projectRootPath = projectRootForEditorPath(editorPath);
  const pathSegments = labels[0].split(".");

  const createPath = dirName => {
    const guessedPath = path.join(projectRootPath, dirName, ...pathSegments);
    return guessedPath + ".elm";
  };

  if (fs.existsSync(createPath("tests"))) {
    return createPath("tests");
  } else if (fs.existsSync(createPath("test"))) {
    return createPath("test");
  } else {
    return null;
  }
}

function projectRootForEditorPath(editorPath) {
  for (const prefix of atom.project.getPaths()) {
    if (editorPath.startsWith(prefix)) {
      return prefix;
    }
  }
  return null;
}

export function runTests(linter, editorPath) {
  // Guard: We need Linter to run.

  if (!initialized) {
    console.warn("Can't run tests without Linter Package installed.");
    return;
  }

  const projectRootPath = projectRootForEditorPath(editorPath);

  // Guard: if there is no "test" or "tests" folder.
  // don't try to run.

  if (
    !fs.existsSync(path.join(projectRootPath, "test")) &&
    !fs.existsSync(path.join(projectRootPath, "tests"))
  ) {
    // Do something
    return;
  }

  const elmTestBinPath = path.join(
    __dirname,
    "..",
    "node_modules",
    ".bin",
    "elm-test"
  );

  if (childProcess) {
    childProcess.kill();
  }

  var child = childProcess = spawn(elmTestBinPath, ["--report", "json"], {
    cwd: projectRootPath
  });

  let data = "";

  child.stdout.on("data", chunk => {
    data += chunk;
  });

  child.stderr.on("data", data => {
    // Only show the notification on status changes.
    if (!isFailing) {
      isFailing = true;
      atom.notifications.addError("Elm tests are failing");
    }
  });

  child.stdout.on("end", () => {
    try {
      const rawResults = data.split("\n");

      // Ends in a new line so, filter the empty line out.
      const results = rawResults.filter(r => r !== "").map(r => JSON.parse(r));

      results.forEach(result => {
        if (result.event === "runComplete" && result.failed === "0") {
          // TODO: Consider not showing an `info` when all tests pass.

          linter.setAllMessages([]);

          if (isFailing) {
            isFailing = false;
            atom.notifications.addSuccess(`All ${result.passed} Elm Tests Pass`);
          }
          return;
        } else if (
          result.event !== "testCompleted" ||
          result.status === "pass"
        ) {
          return;
        }

        // TODO: If we cannot guess the filename, just
        // add the error to the current file, and let the
        // user find it hirself.

        const testPath = guessFileForTest(editorPath, result.labels);

        if (!testPath) {
          console.error(
            "The Test File could not be found. Please Report this.",
            result
          );
          return;
        }

        linter.setAllMessages([
          {
            severity: "error",
            location: {
              file: testPath,
              position: [[0, 0], [0, 1]]
            },
            excerpt: `Failed: [${result.labels.join("][")}]\n`,
            description: `${result.failures.map(f => f.actual)
              .join("\n\n")
              .replace("╷", "\n\n")
              .replace("│", "\n\n│ __")
              .replace("╵", "__\n\n")}`
          }
        ]);
      });
    } catch (e) {
      console.error(e);
      // TODO: Can you pass `e` like this, or should we get the stack somehow.
      atom.notifications.addError("Failed to parse Elm-Test results.", e);
    }
  });
}
