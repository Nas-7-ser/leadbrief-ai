# LeadBrief AI

LeadBrief reads the LinkedIn profile or website you already have open, scores how well that person fits who you sell to, and drafts a short message you can copy. Your leads stay on this computer.

You bring your own OpenAI key. LeadBrief does not have an account, a server, or a key of its own.

## Use it

You need Google Chrome and an [OpenAI API key](https://platform.openai.com/api-keys). Creating a key is free to sign up for. OpenAI charges your account when you analyze a page or write a message.

### 1. Load the extension

If someone sent you a `dist` folder, use that. If you have the project and Node installed, a developer can create it with `npm install` and `npm run build`. The folder you load is `dist`, not the project root.

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Choose the `dist` folder

### 2. Add your key once

1. Click the LeadBrief icon. The side panel opens.
2. Open **Settings**
3. Paste your OpenAI key
4. Click **Save settings**

Until that save, Analyze and message writing stay off. The key is stored in Chrome on this device. It is not written into the project files.

### 3. Score a prospect

1. Open the person's LinkedIn profile, or their company website, in a normal tab
2. In the side panel, check that **Active tab** shows that page
3. Click **Analyze prospect**

You get a match score, a short reason, a few signals from the page, an angle, and one line you can reuse. On LinkedIn, if the panel says it could not read the page, scroll the profile once and try again.

### 4. Write and save

1. Open **Message**
2. Click **Generate** for three short versions: professional, casual, and subtle
3. Click **Copy** on the one you want, or edit it under **Your version** and click **Copy & save**

The lead is saved under the persona selected at the top of the panel. Copying the same person again updates that lead. It does not add a duplicate.

### 5. Follow up later

Click the inbox icon in the panel header. That opens the Leads page.

From a lead you can:

- switch persona at the top — each persona has its own list
- search, or filter by Saved, Contacted, Follow-up, Due now, or Responded
- set any of those four statuses
- pick a follow-up date
- copy the message you sent
- add a note
- delete the lead

**Due now** means the follow-up day is today or earlier.

### What stays private

Leads, notes, personas, and your API key stay in Chrome on this computer. They do not sync to your other devices, and LeadBrief has nowhere to store them.

When you analyze or write a message, the text of the open page is sent from your browser straight to OpenAI, using your key. That is the only time data leaves the machine.

## A few limits

- The brief only knows what is visible on the current page. It does not search the web or open a CRM.
- Each analysis and each message uses your OpenAI account.
- Browser pages such as `chrome://` cannot be analyzed. Switch to the prospect's tab.
- If copying fails, the panel says the browser blocked it. The lead is still saved, so you can copy again from the Leads page.

## For developers

```bash
npm install
npm test          # storage, dates, schemas, prompt safety — no Chrome, no API credit
npm run lint
npm run dev       # Vite, for UI work in a browser tab
npm run build     # writes dist/
npm run package   # tests, then build, then leadbrief-ai.zip
```

Load `dist/` as an unpacked extension after every build. Reload it from `chrome://extensions` to see changes.

### Layout

| Path | Role |
| --- | --- |
| `src/sidepanel/` | Analyze, Message, Settings |
| `src/leads/` | Full-tab lead list |
| `src/lib/` | Storage, prompts, OpenAI call, schemas |
| `src/background/` | Opens the side panel from the toolbar icon |
| `docs/ARCHITECTURE.md` | Pictures of the data flow, the feature list, and the rules tests lock in |
| `manifest.json` | Chrome permissions |

The architecture doc is the map. This file is how to run it.

### Secrets

Do not put an API key in the repo, in `public/`, or in a committed `.env`. Users paste a key in Settings. `public/.env` is gitignored because an old proxy left one there — delete that file if you still have it, and revoke the key in the OpenAI dashboard.

`npm test` fails the package step if a prompt is built with a key inside it.

Tests use Node's built-in test runner. `scripts/run-tests.mjs` bundles them with the esbuild copy already installed for Vite, so the suite does not add another dependency.

### Chrome Web Store

`npm run package` produces `leadbrief-ai.zip` from `dist/`. Upload that zip, not the repository.

Still needed before a store submission:

- PNG icons at 16, 48, and 128, referenced from `manifest.json`
- screenshots of the side panel and the Leads page
- a privacy-policy URL that says data stays in the browser, page text goes to OpenAI with the user's key, and LeadBrief does not run a server

Permissions Chrome will ask about: `sidePanel`, `tabs`, `activeTab`, `scripting`, `storage`, `clipboardWrite`, access to websites the user visits, and `https://api.openai.com/*`.
