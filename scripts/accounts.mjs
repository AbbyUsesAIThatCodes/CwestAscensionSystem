// Provision identities only through an operator shell. No public registration or role switch.
import { openStore } from "../server/store.mjs";
const [command, username, role, studentId] = process.argv.slice(2);
const store = openStore(process.env.CWEST_DB || "data/production.sqlite");
try {
  if (command === "create") {
    if (!process.env.CWEST_ACCOUNT_PASSWORD || !process.env.CWEST_ACCOUNT_NAME)
      throw new Error(
        "Set CWEST_ACCOUNT_NAME and CWEST_ACCOUNT_PASSWORD, then: node scripts/accounts.mjs create USERNAME teacher|student [STUDENT_ID]. Password must have at least 12 characters.",
      );
    store.provision({
      username,
      role,
      studentId,
      name: process.env.CWEST_ACCOUNT_NAME,
      password: process.env.CWEST_ACCOUNT_PASSWORD,
    });
    console.log("Account provisioned. Password was not printed.");
  } else if (command === "revoke") {
    const result = store.db
      .prepare("DELETE FROM accounts WHERE username=?")
      .run(username);
    console.log(`Revoked ${result.changes} account(s) and their sessions.`);
  } else if (command === "list") {
    console.log(
      JSON.stringify(
        store.db
          .prepare("SELECT id,username,name,role,studentId FROM accounts")
          .all(),
        null,
        2,
      ),
    );
  } else
    throw new Error(
      "Usage: node scripts/accounts.mjs create USERNAME teacher|student [STUDENT_ID], revoke USERNAME, or list.",
    );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  store.close();
}
