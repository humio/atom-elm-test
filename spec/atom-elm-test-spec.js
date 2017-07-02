'use babel';

import AtomElmTest from '../lib/atom-elm-test';

// Use the command `window:run-package-specs` (cmd-alt-ctrl-p) to run specs.
//
// To run a specific `it` or `describe` block add an `f` to the front (e.g. `fit`
// or `fdescribe`). Remove the `f` to unfocus the block.

describe('AtomElmTest', () => {
  let workspaceElement, activationPromise;

  beforeEach(() => {
    workspaceElement = atom.views.getView(atom.workspace);
    activationPromise = atom.packages.activatePackage('atom-elm-test');
  });

  describe('when the atom-elm-test:toggle event is triggered', () => {
    it('hides and shows the modal panel', () => {
      // Before the activation event the view is not on the DOM, and no panel
      // has been created
      expect(workspaceElement.querySelector('.atom-elm-test')).not.toExist();

      // This is an activation event, triggering it will cause the package to be
      // activated.
      atom.commands.dispatch(workspaceElement, 'atom-elm-test:toggle');

      waitsForPromise(() => {
        return activationPromise;
      });

      runs(() => {
        expect(workspaceElement.querySelector('.atom-elm-test')).toExist();

        let atomElmTestElement = workspaceElement.querySelector('.atom-elm-test');
        expect(atomElmTestElement).toExist();

        let atomElmTestPanel = atom.workspace.panelForItem(atomElmTestElement);
        expect(atomElmTestPanel.isVisible()).toBe(true);
        atom.commands.dispatch(workspaceElement, 'atom-elm-test:toggle');
        expect(atomElmTestPanel.isVisible()).toBe(false);
      });
    });

    it('hides and shows the view', () => {
      // This test shows you an integration test testing at the view level.

      // Attaching the workspaceElement to the DOM is required to allow the
      // `toBeVisible()` matchers to work. Anything testing visibility or focus
      // requires that the workspaceElement is on the DOM. Tests that attach the
      // workspaceElement to the DOM are generally slower than those off DOM.
      jasmine.attachToDOM(workspaceElement);

      expect(workspaceElement.querySelector('.atom-elm-test')).not.toExist();

      // This is an activation event, triggering it causes the package to be
      // activated.
      atom.commands.dispatch(workspaceElement, 'atom-elm-test:toggle');

      waitsForPromise(() => {
        return activationPromise;
      });

      runs(() => {
        // Now we can test for view visibility
        let atomElmTestElement = workspaceElement.querySelector('.atom-elm-test');
        expect(atomElmTestElement).toBeVisible();
        atom.commands.dispatch(workspaceElement, 'atom-elm-test:toggle');
        expect(atomElmTestElement).not.toBeVisible();
      });
    });
  });
});
