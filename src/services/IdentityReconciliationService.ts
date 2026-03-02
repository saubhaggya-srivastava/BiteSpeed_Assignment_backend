import { IContactRepository } from '../repositories/ContactRepository.interface';
import { ConsolidatedContact } from './NewCustomerService';
import { createNewPrimaryContact } from './NewCustomerService';
import { groupIntoTrees, hasNewInformation } from './ContactTreeManager';
import { createSecondaryContact, buildConsolidatedResponseFromTree } from './SecondaryContactService';
import { mergeTrees } from './TreeMergingService';

export class IdentityReconciliationService {
  constructor(private repository: IContactRepository) {}

  /**
   * Main identity reconciliation algorithm
   * Processes an identity request and returns consolidated contact information
   * @param email Optional email address
   * @param phoneNumber Optional phone number
   * @returns Consolidated contact information
   */
  async identify(email?: string, phoneNumber?: string): Promise<ConsolidatedContact> {
    // Normalize inputs (trim whitespace)
    const normalizedEmail = email?.trim() || undefined;
    const normalizedPhone = phoneNumber?.trim() || undefined;

    // Step 1: Find all matching contacts
    const matches = await this.repository.findByEmailOrPhone(
      normalizedEmail,
      normalizedPhone
    );

    // Step 2: Group matches by contact tree
    const trees = groupIntoTrees(matches);

    // Step 3: Handle scenarios
    if (trees.length === 0) {
      // Scenario A: No matches - create new primary contact
      return await createNewPrimaryContact(
        this.repository,
        normalizedEmail,
        normalizedPhone
      );
    }

    if (trees.length === 1) {
      // Scenario B: One tree matched
      const tree = trees[0];
      const needsNewSecondary = hasNewInformation(tree, normalizedEmail, normalizedPhone);

      if (needsNewSecondary) {
        // Create new secondary contact
        await createSecondaryContact(
          this.repository,
          tree.primary.id,
          normalizedEmail,
          normalizedPhone
        );
      }

      // Return consolidated response (reload tree to include new secondary if created)
      return await buildConsolidatedResponseFromTree(this.repository, tree.primary.id);
    }

    // Scenario C: Two trees matched - merge required
    if (trees.length === 2) {
      return await mergeTrees(this.repository, trees[0], trees[1]);
    }

    // Edge case: More than 2 trees (shouldn't happen in normal operation)
    // Merge all trees into the oldest one
    let oldestTree = trees[0];
    for (let i = 1; i < trees.length; i++) {
      if (trees[i].primary.createdAt < oldestTree.primary.createdAt) {
        oldestTree = trees[i];
      }
    }

    // Merge all other trees into the oldest
    for (const tree of trees) {
      if (tree.primary.id !== oldestTree.primary.id) {
        oldestTree = (await mergeTrees(this.repository, oldestTree, tree)) as any;
        // Reload oldest tree structure after merge
        const contacts = await this.repository.findContactTree(oldestTree.primary.id);
        const primary = contacts.find((c) => c.linkPrecedence === 'primary')!;
        const secondaries = contacts.filter((c) => c.linkPrecedence === 'secondary');
        oldestTree = { primary, secondaries };
      }
    }

    return await buildConsolidatedResponseFromTree(this.repository, oldestTree.primary.id);
  }
}
