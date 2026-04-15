'use client';

import { useState } from 'react';

export default function TopologyViewer() {
    const [activeStep, setActiveStep] = useState<number | null>(null);

    const steps = [
        {
            id: 1,
            title: '1. Frontend Request',
            icon: '🖥️',
            description: 'Người dùng nhập truy vấn tìm kiếm. Ứng dụng React gửi yêu cầu POST đến Backend API.',
            file: 'frontend/src/lib/api.ts',
            code: `export async function vectorSearch(query: string) {
  return fetch(\`\${API_BASE}/api/ai/vector-search\`, {
    method: 'POST',
    body: JSON.stringify({ query })
  });
}`
        },
        {
            id: 2,
            title: '2. Backend Handler',
            icon: '⚙️',
            description: 'Gin Router tiếp nhận yêu cầu HTTP và điều phối luồng xử lý tìm kiếm vector.',
            file: 'backend/handlers/ai.go',
            code: `func VectorSearch(c *gin.Context) {
  // ...
  // 1. Generate embedding for query
  queryEmbedding, _ := aiClient.GenerateEmbedding(req.Query)
  
  // 2. Format vector for Cassandra
  vectorStr := formatVectorForCQL(queryEmbedding)
  
  // ...
}`
        },
        {
            id: 3,
            title: '3. AI Embedding',
            icon: '🧠',
            description: 'Văn bản được chuyển đổi thành vector không gian 1536 chiều thông qua OpenRouter API (LLM).',
            file: 'backend/services/openrouter.go',
            code: `// Model: openai/text-embedding-3-small
func (c *OpenRouterClient) GenerateEmbedding(text string) {
  // Calls https://openrouter.ai/api/v1/embeddings
  // Returns []float32
}`
        },
        {
            id: 4,
            title: '4. Truy Vấn SAI Cassandra',
            icon: '🍃',
            description: 'Storage Attached Index (SAI) thực hiện thuật toán tìm kiếm lân cận gần đúng (ANN). Hàm similarity_cosine() tính toán điểm tương đồng.',
            file: 'backend/handlers/ai.go',
            code: `// ANN: Approximate Nearest Neighbor
query := fmt.Sprintf(
  // similarity_cosine is a native Cassandra function!
  \`SELECT ... similarity_cosine(embedding, %s) as score 
   FROM todo_embeddings 
   ORDER BY embedding ANN OF %s 
   LIMIT ?\`,
  vectorStr, vectorStr
)`
        },
        {
            id: 5,
            title: '5. Schema & Index',
            icon: '🗄️',
            description: 'Cơ sở dữ liệu lưu trữ vector và chỉ mục SAI được tối ưu hóa cho truy vấn tương đồng hiệu năng cao.',
            file: 'backend/db/cassandra.go',
            code: `// Vector Column
embedding VECTOR<FLOAT, 1536>

// SAI Index Creation
CREATE CUSTOM INDEX todo_embeddings_vector_idx 
ON todo_embeddings (embedding)
USING 'StorageAttachedIndex'
WITH OPTIONS = {'similarity_function': 'cosine'}`
        }
    ];

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-1)', marginBottom: '8px' }}>
                    Kiến Trúc Tìm Kiếm Vector (Vector Search Topology)
                </h2>
                <p style={{ color: 'var(--text-3)', fontSize: '14px' }}>
                    Luồng xử lý dữ liệu khép kín: React UI ➡️ Backend ➡️ AI Model ➡️ Cassandra SAI
                </p>
            </div>

            {/* Diagram */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'relative',
                marginBottom: '40px',
                gap: '10px'
            }}>
                {/* Connecting Line */}
                <div style={{
                    position: 'absolute',
                    top: '40px',
                    left: '40px',
                    right: '40px',
                    height: '2px',
                    background: 'var(--border)',
                    zIndex: 0
                }} />

                {steps.map((step) => (
                    <div
                        key={step.id}
                        onClick={() => step.id && setActiveStep(step.id)}
                        style={{
                            position: 'relative',
                            zIndex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            cursor: 'pointer',
                            flex: 1
                        }}
                    >
                        <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            background: activeStep === step.id ? 'var(--accent)' : 'var(--bg-card)',
                            border: `2px solid ${activeStep === step.id ? 'var(--accent)' : 'var(--border)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '32px',
                            boxShadow: activeStep === step.id ? '0 0 20px rgba(var(--accent-rgb), 0.3)' : 'none',
                            transition: 'all 0.2s ease'
                        }}>
                            {step.icon}
                        </div>
                        <div style={{
                            marginTop: '12px',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: activeStep === step.id ? 'var(--text-1)' : 'var(--text-3)',
                            textAlign: 'center'
                        }}>
                            {step.title && step.title.includes('. ') ? step.title.split('. ')[1] : step.title}
                        </div>
                    </div>
                ))}
            </div>

            {/* Detail View */}
            <div style={{ minHeight: '300px' }}>
                {activeStep ? (
                    (() => {
                        const step = steps.find(s => s.id === activeStep)!;
                        return (
                            <div className="card fade-in" style={{ padding: '24px', borderLeft: '4px solid var(--accent)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-1)' }}>
                                            {step.title}
                                        </h3>
                                        <p style={{ margin: '4px 0 0', color: 'var(--text-3)', fontSize: '14px' }}>
                                            {step.description}
                                        </p>
                                    </div>
                                    <div className="badge badge-medium">
                                        📄 {step.file}
                                    </div>
                                </div>

                                <div style={{
                                    background: 'var(--bg-code)',
                                    padding: '16px',
                                    borderRadius: '8px',
                                    overflowX: 'auto',
                                    fontFamily: 'monospace',
                                    fontSize: '13px',
                                    color: 'var(--text-2)',
                                    lineHeight: '1.5'
                                }}>
                                    <pre style={{ margin: 0 }}>{step.code}</pre>
                                </div>
                            </div>
                        );
                    })()
                ) : (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px',
                        color: 'var(--text-3)',
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        border: '2px dashed var(--border)'
                    }}>
                        👆 Nhấp vào các bước trên sơ đồ để xem chi tiết kỹ thuật và mã nguồn
                    </div>
                )}
            </div>
        </div>
    );
}
