import * as vscode from 'vscode';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {

    console.log('Congratulations, your extension "maou" is now active!');

    // Register a command that will create our webview panel
    let disposable = vscode.commands.registerCommand('zenevo.start', () => {
        // Create and show a new webview panel
        const panel = vscode.window.createWebviewPanel(
            'maouChat', // Identifies the type of the webview. Used internally
            'Maou', // Title of the panel displayed to the user
            vscode.ViewColumn.Two, // Editor column to show the new webview panel in
            {} // Webview options. We can leave this empty for now
        );

        // Set the HTML content for the webview
        panel.webview.html = getWebviewContent();
    });

    context.subscriptions.push(disposable);
}

// A helper function to get the HTML content for our webview
function getWebviewContent() {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Maou</title>
  </head>
  <body>
      <h1>Welcome to Maou!</h1>
      <p>Your AI coding partner.</p>
      <button>Login with Google</button>
      <hr>
      <textarea placeholder="Chat with Maou..." rows="4" style="width: 95%;"></textarea>
      <br>
      <button>Send</button>
  </body>
  </html>`;
}


// This method is called when your extension is deactivated
export function deactivate() {}