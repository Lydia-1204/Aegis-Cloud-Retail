export function OverviewPage() {
  return (
    <section>
      <h2>前端基础框架已就绪</h2>
      <p>当前模块按《Aegis接口设计文档》拆分，支持总部侧主数据与调拨流程的基础展示。</p>
      <div className="cards-grid">
        <article className="card">
          <h3>认证与权限</h3>
          <p>预留 JWT 与 RBAC 扩展点，后续可接入登录态和权限守卫。</p>
        </article>
        <article className="card">
          <h3>接口规范</h3>
          <p>已统一使用 envelope 与分页结构，前后端字段按 snake_case 对齐。</p>
        </article>
        <article className="card">
          <h3>运行模式</h3>
          <p>默认 mock 数据可直接运行，设置 VITE_USE_MOCK=false 即可切真实后端。</p>
        </article>
      </div>
    </section>
  );
}
