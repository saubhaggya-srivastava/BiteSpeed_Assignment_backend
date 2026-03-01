import { PrismaClient, Prisma } from '@prisma/client';
import { Contact, CreateContactInput, UpdateContactInput } from '../models/Contact';
import { IContactRepository } from './ContactRepository.interface';
import { DatabaseError } from '../errors/CustomErrors';

export class ContactRepository implements IContactRepository {
  constructor(private prisma: PrismaClient) {}

  async findByEmailOrPhone(email?: string, phoneNumber?: string): Promise<Contact[]> {
    try {
      const where: Prisma.ContactWhereInput = {
        deletedAt: null,
        OR: [],
      };

      if (email) {
        where.OR!.push({ email });
      }
      if (phoneNumber) {
        where.OR!.push({ phoneNumber });
      }

      if (!where.OR || where.OR.length === 0) {
        return [];
      }

      const contacts = await this.prisma.contact.findMany({ where });
      return contacts.map(this.mapToContact);
    } catch (error) {
      throw new DatabaseError('Failed to find contacts', error);
    }
  }

  async findContactTree(primaryId: number): Promise<Contact[]> {
    try {
      const contacts = await this.prisma.contact.findMany({
        where: {
          deletedAt: null,
          OR: [
            { id: primaryId },
            { linkedId: primaryId },
          ],
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
      return contacts.map(this.mapToContact);
    } catch (error) {
      throw new DatabaseError('Failed to find contact tree', error);
    }
  }

  async create(input: CreateContactInput): Promise<Contact> {
    try {
      const contact = await this.prisma.contact.create({
        data: {
          phoneNumber: input.phoneNumber ?? null,
          email: input.email ?? null,
          linkedId: input.linkedId ?? null,
          linkPrecedence: input.linkPrecedence,
        },
      });
      return this.mapToContact(contact);
    } catch (error) {
      throw new DatabaseError('Failed to create contact', error);
    }
  }

  async update(id: number, updates: UpdateContactInput): Promise<Contact> {
    try {
      const contact = await this.prisma.contact.update({
        where: { id },
        data: updates,
      });
      return this.mapToContact(contact);
    } catch (error) {
      throw new DatabaseError('Failed to update contact', error);
    }
  }

  async updateMany(updates: Array<{ id: number; data: UpdateContactInput }>): Promise<void> {
    try {
      await Promise.all(
        updates.map((update) =>
          this.prisma.contact.update({
            where: { id: update.id },
            data: update.data,
          })
        )
      );
    } catch (error) {
      throw new DatabaseError('Failed to update multiple contacts', error);
    }
  }

  async transaction<T>(fn: (repo: IContactRepository) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const txRepo = new ContactRepository(tx as PrismaClient);
        return await fn(txRepo);
      });
    } catch (error) {
      throw new DatabaseError('Transaction failed', error);
    }
  }

  private mapToContact(prismaContact: any): Contact {
    return {
      id: prismaContact.id,
      phoneNumber: prismaContact.phoneNumber,
      email: prismaContact.email,
      linkedId: prismaContact.linkedId,
      linkPrecedence: prismaContact.linkPrecedence as 'primary' | 'secondary',
      createdAt: prismaContact.createdAt,
      updatedAt: prismaContact.updatedAt,
      deletedAt: prismaContact.deletedAt,
    };
  }
}
