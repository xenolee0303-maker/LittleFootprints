export type ChildGender = 'female' | 'male' | 'unspecified';

export interface Child {
  id: string;
  name: string;
  gender: ChildGender;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChildInput {
  name: string;
  gender?: ChildGender;
}

export type UpdateChildInput = Partial<CreateChildInput>;
