# Security Spec for DeepTalk

## 1. Data Invariants
- A **Room** must be created before any messages or presence can be established.
- A **Message** must contain a `senderId`, `nickname`, `text`, `type`, and `timestamp`.
- **Presence** updates must be for the current authenticated user.
- **MusicState** can only be updated by a user present in the room.
- All timestamps (`createdAt`, `updatedAt`, `timestamp`, `lastSeen`) must be set to `request.time` (Server Timestamp).
- Documents are ephemeral; once `expiresAt` is passed, access should theoretically be revoked (though rules have limited time-comparison capabilities for future dates without functions, we check `request.time`).

## 2. The "Dirty Dozen" Payloads (Denial Tests)
1. **Identity Spoofing**: Attempt to write a message with `senderId` that doesn't match `request.auth.uid`.
2. **Room Creation Bypass**: Attempt to write a message to a non-existent room ID.
3. **Ghost Field Injection**: Adding an `isAdmin: true` field to a Message or Room document.
4. **Invalid Type**: Sending `text: true` instead of `text: "hello"`.
5. **Payload Size Attack**: Sending a 2MB string in the `text` field.
6. **Time Spoofing**: Sending a manual `timestamp` from the client that isn't `request.time`.
7. **Cross-Room Access**: Attempt to read messages from room `ABCDEF` when only room `123456` was joined.
8. **Presence Hijacking**: Attempt to update another user's presence document.
9. **Music State Sabotage**: Setting `progress` to a negative number or a value exceeding track duration.
10. **Room Metadata Tampering**: Updating `expiresAt` to a date 10 years in the future.
11. **System Message Forgery**: Sending a message with `type: "system"` as a regular user.
12. **Anonymous Scraping**: Attempting a `list` query on all rooms without a specific room ID filter.

## 3. Test Runner (Draft)
A `firestore.rules.test.ts` will verify these conditions using the Firebase Emulator (if available) or logic analysis. Since we are in a containerized environment, we will rely on generating the rules and validating them with the ESLint plugin.
