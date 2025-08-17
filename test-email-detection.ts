import { gmailClient } from "./functions/lib/gmail";
import { createSimpleLogger } from "./functions/lib/simple-logger";
import { storageClient } from "./functions/lib/storage";

const log = createSimpleLogger("test-email-detection");

async function testEmailDetection() {
  try {
    log.info("Testing email detection...");

    // Fetch AI emails
    const emails = await gmailClient.getWeeklyAIEmails();
    log.info(`Found ${emails.length} AI-related emails`);

    if (emails.length > 0) {
      log.info("Sample emails:");
      emails.slice(0, 3).forEach((email) => {
        log.info(`  - ${email.subject} (ID: ${email.id})`);
      });

      // Check processed status
      const processedIds = await storageClient.getWeeklyProcessedIds();
      log.info(`Already processed: ${processedIds.length} emails`);

      const unprocessed = emails.filter((e) => !processedIds.includes(e.id));
      log.info(`Unprocessed: ${unprocessed.length} emails`);

      if (unprocessed.length > 0) {
        log.info("Sample unprocessed:");
        unprocessed.slice(0, 3).forEach((email) => {
          log.info(`  - ${email.subject}`);
        });
      }
    } else {
      log.info("No AI emails found. Checking all recent emails...");
      const allEmails = await gmailClient.getAllRecentEmails();
      log.info(`Total recent emails: ${allEmails.length}`);
      if (allEmails.length > 0) {
        log.info("Sample of all emails:");
        allEmails.slice(0, 5).forEach((email) => {
          log.info(`  - ${email.subject}`);
        });
      }
    }
  } catch (error) {
    log.error("Test failed:", error);
  }
}

testEmailDetection();
