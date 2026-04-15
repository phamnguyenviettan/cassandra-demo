package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

const (
	openRouterBaseURL    = "https://openrouter.ai/api/v1"
	chatModel            = "openai/gpt-oss-20b:free"
	embeddingModel       = "openai/text-embedding-3-small"
)

type OpenRouterClient struct {
	apiKey     string
	httpClient *http.Client
}

func NewOpenRouterClient() *OpenRouterClient {
	return &OpenRouterClient{
		apiKey:     os.Getenv("OPENROUTER_API_KEY"),
		httpClient: &http.Client{},
	}
}

// Chat completion request/response types
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Model    string        `json:"model"`
	Messages []ChatMessage `json:"messages"`
}

type ChatChoice struct {
	Message ChatMessage `json:"message"`
}

type ChatResponse struct {
	Choices []ChatChoice `json:"choices"`
}

// Embedding request/response types
type EmbeddingRequest struct {
	Model string `json:"model"`
	Input string `json:"input"`
}

type EmbeddingData struct {
	Embedding []float32 `json:"embedding"`
	Index     int       `json:"index"`
}

type EmbeddingResponse struct {
	Data []EmbeddingData `json:"data"`
}

// GenerateTask calls OpenRouter chat API to generate a todo task from a prompt
func (c *OpenRouterClient) GenerateTask(prompt string) (string, string, string, error) {
	messages := []ChatMessage{
		{
			Role: "system",
			Content: `You are a helpful task assistant. When given a prompt, generate a single todo task.
Respond ONLY in valid JSON format with these fields:
{
  "title": "concise task title",
  "description": "brief task description",
  "priority": "Low" or "Medium" or "High"
}
Do not include any other text, only the JSON object.`,
		},
		{
			Role:    "user",
			Content: prompt,
		},
	}

	reqBody := ChatRequest{
		Model:    chatModel,
		Messages: messages,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", "", "", fmt.Errorf("failed to marshal request: %v", err)
	}

	req, err := http.NewRequest("POST", openRouterBaseURL+"/chat/completions", bytes.NewBuffer(body))
	if err != nil {
		return "", "", "", fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", "", "", fmt.Errorf("failed to call OpenRouter: %v", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", "", fmt.Errorf("failed to read response: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", "", "", fmt.Errorf("OpenRouter API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	var chatResp ChatResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return "", "", "", fmt.Errorf("failed to parse response: %v", err)
	}

	if len(chatResp.Choices) == 0 {
		return "", "", "", fmt.Errorf("no response from OpenRouter")
	}

	// Parse the JSON response from the LLM
	content := chatResp.Choices[0].Message.Content
	var taskData struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Priority    string `json:"priority"`
	}

	if err := json.Unmarshal([]byte(content), &taskData); err != nil {
		// If parsing fails, use the raw content as title
		return content, "", "Medium", nil
	}

	if taskData.Priority != "Low" && taskData.Priority != "Medium" && taskData.Priority != "High" {
		taskData.Priority = "Medium"
	}

	return taskData.Title, taskData.Description, taskData.Priority, nil
}

// GenerateEmbedding calls OpenRouter embedding API to get vector for text
func (c *OpenRouterClient) GenerateEmbedding(text string) ([]float32, error) {
	reqBody := EmbeddingRequest{
		Model: embeddingModel,
		Input: text,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %v", err)
	}

	req, err := http.NewRequest("POST", openRouterBaseURL+"/embeddings", bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call OpenRouter: %v", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OpenRouter embedding API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	var embResp EmbeddingResponse
	if err := json.Unmarshal(respBody, &embResp); err != nil {
		return nil, fmt.Errorf("failed to parse embedding response: %v", err)
	}

	if len(embResp.Data) == 0 {
		return nil, fmt.Errorf("no embedding data returned")
	}

	return embResp.Data[0].Embedding, nil
}
