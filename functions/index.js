// Import the Firebase Admin SDK and initialize Firebase.
const admin = require("firebase-admin");
admin.initializeApp();

// Import the Cloud Functions for Firebase SDK.
const functions = require("firebase-functions");

/**
 * A scheduled Cloud Function that runs on the 1st of every month.
 * It checks for users who have been inactive for more than 12 months
 * and deletes their data from Realtime Database and their account from
 * Firebase Authentication.
 */
exports.deleteInactiveUsers = functions.pubsub
  // We recommend running this monthly to catch all users without running too often.
  // This cron expression means "at 00:00 on day-of-month 1".
  .schedule("0 0 1 * *")
  .timeZone("UTC") // Set the timezone to UTC for consistency.
  .onRun(async (context) => {
    // 1. Calculate the inactivity threshold date (12 months ago).
    const inactiveThresholdDate = new Date();
    inactiveThresholdDate.setFullYear(inactiveThresholdDate.getFullYear() - 1);
    const inactiveThresholdISO = inactiveThresholdDate.toISOString();

    console.log(
      `Starting user cleanup. Deleting users inactive before: ${inactiveThresholdISO}`
    );

    // 2. Get a reference to all users in the Realtime Database.
    const usersRef = admin.database().ref("/Users");
    const snapshot = await usersRef.once("value");

    if (!snapshot.exists()) {
      console.log("No 'Users' node found in Realtime Database. Exiting.");
      return null;
    }

    const deletions = [];
    const usersData = snapshot.val();

    // 3. Loop through each user to check their last login time.
    for (const userId in usersData) {
      const userData = usersData[userId];
      const lastLogInTime = userData.lastLogInTime;

      // Ensure the lastLogInTime exists and is older than the threshold.
      if (lastLogInTime && lastLogInTime < inactiveThresholdISO) {
        console.log(`Scheduling deletion for inactive user: ${userId}`);

        // 4. Create promises to delete the user's Auth record and DB record.
        const deleteDbPromise = usersRef.child(userId).remove();
        const deleteAuthPromise = admin.auth().deleteUser(userId);

        deletions.push(
          Promise.all([deleteDbPromise, deleteAuthPromise])
            .then(() =>
              console.log(
                `Successfully deleted user ${userId} from Auth and Database.`
              )
            )
            .catch((error) =>
              console.error(`Error deleting user ${userId}:`, error)
            )
        );
      }
    }

    // 5. Wait for all deletion operations to complete.
    await Promise.all(deletions);
    console.log("Inactive user cleanup finished.");
    return null;
  });