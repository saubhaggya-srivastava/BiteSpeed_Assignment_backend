import { Contact, ContactTree } from '../models/Contact';

/**
 * Groups contacts into their respective contact trees
 * @param contacts Array of contacts to group
 * @returns Array of ContactTree objects, each containing a primary and its secondaries
 */
export function groupIntoTrees(contacts: Contact[]): ContactTree[] {
  const treeMap = new Map<number, ContactTree>();

  for (const contact of contacts) {
    // Determine the primary ID for this contact
    const primaryId =
      contact.linkPrecedence === 'primary' ? contact.id : contact.linkedId!;

    // Get or create tree
    if (!treeMap.has(primaryId)) {
      // Find the primary contact
      const primary =
        contact.linkPrecedence === 'primary'
          ? contact
          : contacts.find((c) => c.id === primaryId);

      if (!primary) {
        // If primary not found in the list, skip this contact
        // This shouldn't happen in normal operation
        continue;
      }

      treeMap.set(primaryId, {
        primary,
        secondaries: [],
      });
    }

    // Add secondary to tree
    if (contact.linkPrecedence === 'secondary') {
      treeMap.get(primaryId)!.secondaries.push(contact);
    }
  }

  return Array.from(treeMap.values());
}

/**
 * Checks if a contact tree already contains the exact email/phone combination
 * @param tree The contact tree to check
 * @param email Optional email to check
 * @param phoneNumber Optional phone number to check
 * @returns true if exact match exists, false otherwise
 */
export function exactMatchExists(
  tree: ContactTree,
  email?: string,
  phoneNumber?: string
): boolean {
  const allContacts = [tree.primary, ...tree.secondaries];

  return allContacts.some((contact) => {
    // If email is provided, it must match (or contact.email must be null)
    const emailMatches = !email || contact.email === email;
    
    // If phoneNumber is provided, it must match (or contact.phoneNumber must be null)
    const phoneMatches = !phoneNumber || contact.phoneNumber === phoneNumber;
    
    // For exact match, both must match
    return emailMatches && phoneMatches;
  });
}

/**
 * Checks if the provided email/phone combination brings new information to the tree
 * @param tree The contact tree to check
 * @param email Optional email to check
 * @param phoneNumber Optional phone number to check
 * @returns true if new information is present, false otherwise
 */
export function hasNewInformation(
  tree: ContactTree,
  email?: string,
  phoneNumber?: string
): boolean {
  const allContacts = [tree.primary, ...tree.secondaries];

  // Check if email is new
  const emailIsNew = email && !allContacts.some((c) => c.email === email);
  
  // Check if phone is new
  const phoneIsNew = phoneNumber && !allContacts.some((c) => c.phoneNumber === phoneNumber);

  return emailIsNew || phoneIsNew;
}
