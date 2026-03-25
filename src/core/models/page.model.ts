export interface PageModel<T> {
    pageNumber: number;
    pageSize: number;
    total: number;
    totalPages: number;
    data: T[];
}

export interface PageRequest {
    page: number;
    pageSize: number;
    cursor?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    filter?: { [key: string]: string };
}

export type GetRequestParams =
    | { pagination: true; page: PageRequest; fields?: string[] }
    | { pagination: false; fields: [string, ...string[]] };
