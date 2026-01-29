export interface Service {
    id: number;
    name: string;
    price: number;
    duration_min: number;
}

export interface MasterProfile {
    salon_name: string;
    address: string;
    phone: string;
    description: string;
    avatar_url: string;
}