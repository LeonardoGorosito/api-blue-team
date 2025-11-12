export default async function health(app) {
    app.get('/health', async () => ({ ok: true }));
}
//# sourceMappingURL=admin.js.map