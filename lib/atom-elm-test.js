"use babel";

import { CompositeDisposable } from "atom";
import spawn from "cross-spawn";
import child_process from "child_process";
import path from "path";

let subscriptions = null;

export function activate(state) {
  subscriptions = new CompositeDisposable();
  // TODO: Allow people to run the tests them through a command.
  // subscriptions.add(
  //   atom.commands.add("atom-workspace", {
  //     "atom-elm-test:run-tests": runTests
  //   })
  // );
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
  // TODO: Also support "test" folder.
  const guessedPath = path.join(projectRootPath, "tests", ...pathSegments);
  return guessedPath + ".elm";
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
  const elmTestBinPath = path.join(
    __dirname,
    "..",
    "node_modules",
    ".bin",
    "elm-test"
  );
  const projectRootPath = projectRootForEditorPath(editorPath);

  var child = spawn(elmTestBinPath, ["--report", "json"], {
    cwd: projectRootPath
  });

  let data = "";

  child.stdout.on("data", chunk => {
    data += chunk;
  });

  child.stderr.on("data", data => {
    atom.notifications.addError("Error Running Elm-Test", {
      detail: data
    });
  });

  child.stdout.on("end", () => {
    try {
      const rawResults = data.split("\n");

      // Ends in a new line so, filter the empty line out.
      const results = rawResults.filter(r => r !== "").map(r => JSON.parse(r));

      results.forEach(result => {
        if (result.event === "runComplete" && result.failed === "0") {
          // TODO: Consider not showing an `info` when all tests pass.
          linter.setMessages(editorPath, [
            {
              severity: "info",
              location: {
                file: editorPath,
                position: [[0, 0], [0, 1]]
              },
              excerpt: `All '${result}' Tests Pass`,
              description: `Yay!`
            }
          ]);
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
        console.log(result);
        const testPath = guessFileForTest(editorPath, result.labels);

        linter.setMessages(testPath, [
          {
            severity: "error",
            location: {
              file: testPath,
              position: [[0, 0], [0, 1]]
            },
            excerpt: `Failed: ${result.labels.join(" -> ")}`,
            description: `${result.labels.join(" -> ")}`
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
