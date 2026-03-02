import { IContactRepository } from '../repositories/ContactRepository.interface';
import { Contact, ContactTree } from '../models/Contact';
import { ConsolidatedContact } from './NewCustomerService';

/**
 * Creates a new secondary contact linked to a primary contact
 * @param repository Contact repository instance
 * @param primaryId ID of the primary contact
 * @param email Optional email address
 * @param phoneNumber Optional phone number
 * @returns The created secondary contact
 */
export async function createSecondaryContact(
  repository: IContactRepository,
  primaryId: number,
  email?: string,
  phoneNumber?: string
): Promise<Contact> {
  return await repository.create({
    email: email || null,
    phoneNumber: phoneNumber || null,
    linkPrecedence: 'secondary',
    linkedId: primaryId,
  });
}

/**
 * Builds a consolidated response from a contact tree
 * @param repository Contact repository instance
 * @param primaryId ID of the primary contact
 * @returns Consolidated contact information
 */
export async function buildConsolidatedResponseFromTree(
  repository: IContactRepository,
  primaryId: number
): Promise<ConsolidatedContact> {
  // Retrieve complete contact tree from database
  const contacts = await repository.findContactTree(primaryId);

  // Separate primary and secondaries
  const primary = contacts.find((c) => c.linkPrecedence === 'primary');
  if (!primary) {
    throw new Error(`Primary contact with id ${primaryId} not found`);
  }

  const secondaries = contacts
    .filter((c) => c.linkPrecedence === 'secondary')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

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

  // Collect secondary IDs (already sorted by createdAt)
  const secondaryContactIds = secondaries.map((s) => s.id);

  return {
    primaryContactId: primary.id,
    emails,
    phoneNumbers,
    secondaryContactIds,
  };
}
