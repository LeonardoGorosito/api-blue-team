import dotenv from 'dotenv';
dotenv.config();
export const ENV = {
    PORT: Number(process.env.PORT || 3000),
    FRONTEND_URL: process.env.FRONTEND_URL,
    JWT_SECRET: process.env.JWT_SECRET,
};
//# sourceMappingURL=env.js.map