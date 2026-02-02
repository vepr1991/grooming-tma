export interface Service {
    id: number;
    name: string;
    price: number;
    duration_min: number;
    description?: string; // Добавили ? так как может не быть
}

export interface MasterProfile {
    salon_name: string;
    address: string;
    phone: string;
    description: string;
    avatar_url: string;
    timezone: string; // <--- НОВОЕ ПОЛЕ
}