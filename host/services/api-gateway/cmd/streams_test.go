package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStreamCRUD(t *testing.T) {
	mux := http.NewServeMux()
	setupStreamRoutes(mux)
	srv := httptest.NewServer(mux)
	defer srv.Close()

	// create
	body, _ := json.Marshal(Stream{ID: "s1", Codecs: []string{"h264"}, Transports: []string{"webrtc"}})
	resp, err := http.Post(srv.URL+"/streams", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create status %d", resp.StatusCode)
	}

	// get
	resp, err = http.Get(srv.URL + "/streams/s1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("get status %d", resp.StatusCode)
	}

	// update
	upd := Stream{Codecs: []string{"vp9"}, Transports: []string{"webrtc"}}
	body, _ = json.Marshal(upd)
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/streams/s1", bytes.NewReader(body))
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("put: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("put status %d", resp.StatusCode)
	}

	// list
	resp, err = http.Get(srv.URL + "/streams")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("list status %d", resp.StatusCode)
	}

	// delete
	req, _ = http.NewRequest(http.MethodDelete, srv.URL+"/streams/s1", nil)
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("delete: %v", err)
	}
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("delete status %d", resp.StatusCode)
	}
}

func TestSignaling(t *testing.T) {
	mux := http.NewServeMux()
	setupStreamRoutes(mux)
	srv := httptest.NewServer(mux)
	defer srv.Close()

	// create stream
	body, _ := json.Marshal(Stream{ID: "s2"})
	resp, _ := http.Post(srv.URL+"/streams", "application/json", bytes.NewReader(body))
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create status %d", resp.StatusCode)
	}

	// offer
	offer := map[string]string{"sdp": "offer"}
	body, _ = json.Marshal(offer)
	resp, err := http.Post(srv.URL+"/streams/s2/offer", "application/json", bytes.NewReader(body))
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("post offer: %v status %d", err, resp.StatusCode)
	}

	// answer
	ans := map[string]string{"sdp": "answer"}
	body, _ = json.Marshal(ans)
	resp, err = http.Post(srv.URL+"/streams/s2/answer", "application/json", bytes.NewReader(body))
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("post answer: %v status %d", err, resp.StatusCode)
	}

	// ice
	ic := map[string]string{"candidate": "ice1"}
	body, _ = json.Marshal(ic)
	resp, err = http.Post(srv.URL+"/streams/s2/ice", "application/json", bytes.NewReader(body))
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("post ice: %v status %d", err, resp.StatusCode)
	}

	// get offer
	resp, err = http.Get(srv.URL + "/streams/s2/offer")
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("get offer: %v status %d", err, resp.StatusCode)
	}

	// get answer
	resp, err = http.Get(srv.URL + "/streams/s2/answer")
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("get answer: %v status %d", err, resp.StatusCode)
	}

	// get ice
	resp, err = http.Get(srv.URL + "/streams/s2/ice")
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("get ice: %v status %d", err, resp.StatusCode)
	}
}
