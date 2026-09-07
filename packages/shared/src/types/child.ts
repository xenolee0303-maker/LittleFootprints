export interface Child {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChildInput {
  name: string;
}

export type UpdateChildInput = Partial<CreateChildInput>;
