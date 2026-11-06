// backend/internal/aiclient/client.go
package aiclient

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type Request struct {
	BusinessID   *string       `json:"businessId"`
	BusinessName string        `json:"businessName"`
	Messages     []ChatMessage `json:"messages"`
}

type Reply struct {
	Text  string  `json:"text"`
	HTML  *string `json:"html"`
	Error string  `json:"error"`
}

type Client struct {
	url  string
	key  string
	http *http.Client
}

func New(url, key string) *Client {
	return &Client{url: url, key: key, http: &http.Client{Timeout: 90 * time.Second}}
}

func (c *Client) Ask(ctx context.Context, req Request) (*Reply, error) {
	if c.url == "" {
		return nil, errors.New("AI_SERVICE_URL is not configured")
	}
	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-internal-key", c.key) // shared secret between our two services

	res, err := c.http.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	var reply Reply
	if err := json.NewDecoder(res.Body).Decode(&reply); err != nil {
		return nil, fmt.Errorf("bad AI response (status %d)", res.StatusCode)
	}
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AI service error (%d): %s", res.StatusCode, reply.Error)
	}
	return &reply, nil
}