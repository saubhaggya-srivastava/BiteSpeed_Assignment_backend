import { IContactRepository } from '../repositories/ContactRepository.interface';
import { ContactTree } from '../models/Contact';
import { ConsolidatedContact } from './NewCustomerService';
import { buildConsolidatedResponseFromTree } from './SecondaryContactService';

/**
 * Merges two contact trees by making the older primary the root
 * @param repository Contact repository instance
 * @param tree1 First contact tree
 * @param tree2 Second contact tree
 * @returns Consolidated contact information with merged tree
 */
export async function mergeTrees(
  repository: IContactRepository,
  tree1: ContactTree,
  tree2: ContactTree
): Promise<ConsolidatedContact> {
  return await repository.transaction(async (repo) => {
    // Step 1: Determine which primary is older
    const olderTree =
      tree1.primary.createdAt <= tree2.primary.createdAt ? tree1 : tree2;
    const newerTree = olderTree === tree1 ? tree2 : tree1;

    const keepPrimaryId = olderTree.primary.id;
    const convertPrimaryId = newerTree.primary.id;

    // Step 2: Convert newer primary to secondary
    await repo.update(convertPrimaryId, {
      linkPrecedence: 'secondary',
      linkedId: keepPrimaryId,
    });

    // Step 3: Update all secondaries of newer tree to point to older primary
    const updates = newerTree.secondaries.map((secondary) => ({
      id: secondary.id,
      data: { linkedId: keepPrimaryId },
    }));

    if (updates.length > 0) {
      await repo.updateMany(updates);
    }

    // Step 4: Build consolidated response
    return await buildConsolidatedResponseFromTree(repo, keepPrimaryId);
  });
}
