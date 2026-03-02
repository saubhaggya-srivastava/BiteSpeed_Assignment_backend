import { IContactRepository } from '../repositories/ContactRepository.interface';
import { Contact } from '../models/Contact';

export interface ConsolidatedContact {
  primaryContactId: number;
  emails: string[];
  phoneNumbers: string[];
  secondaryContactIds: number[];
}

/**
 * Creates a new primary contact for a new customer
 * @param repository Contact repository instance
 * @param email Optional email address
 * @param phoneNumber Optional phone number
 * @returns Consolidated contact information
 */
export async function createNewPrimaryContact(
  repository: IContactRepository,
  email?: string,
  phoneNumber?: string
): Promise<ConsolidatedContact> {
  // Create new primary contact
  const contact = await repository.create({
    email: email || null,
    phoneNumber: phoneNumber || null,
    linkPrecedence: 'primary',
    linkedId: null,
  });

  // Build consolidated response
  return buildConsolidatedResponse(contact, []);
}

/**
 * Builds a consolidated response from a primary contact and its secondaries
 * @param primary Primary contact
 * @param secondaries Array of secondary contacts
 * @returns Consolidated contact information
 */
export function buildConsolidatedResponse(
  primary: Contact,
  secondaries: Contact[]
): ConsolidatedContact {
  // Collect unique emails (primary first)
  const emails: string[] = [];
  if (primary.email) {
    emails.push(primary.email);
  }
  for (const secondary of secondaries) {
    if (secondary.email && !emails.includes(secondary.email)) {
      emails.push(secondary.email);
    }
  }

  // Collect unique phone numbers (primary first)
  const phoneNumbers: string[] = [];
  if (primary.phoneNumber) {
    phoneNumbers.push(primary.phoneNumber);
  }
  for (const secondary of secondaries) {
    if (secondary.phoneNumber && !phoneNumbers.includes(secondary.phoneNumber)) {
      phoneNumbers.push(secondary.phoneNumber);
    }
  }

  // Collect secondary IDs (already sorted by createdAt in query)
  const secondaryContactIds = secondaries.map((s) => s.id);

  return {
    primaryContactId: primary.id,
    emails,
    phoneNumbers,
    secondaryContactIds,
  };
}
