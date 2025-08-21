package abr

import "sync"

// Profile represents a rung in the adaptive bitrate ladder.
type Profile struct {
	Resolution string
	FPS        int
	Bitrate    int // bits per second
}

// Controller selects encoder profiles based on bandwidth feedback.
type Controller struct {
	ladder  []Profile
	current Profile
	mu      sync.RWMutex
}

// NewController initializes a Controller with an ordered ladder (highest to lowest bitrate).
func NewController(ladder []Profile) *Controller {
	if len(ladder) == 0 {
		panic("abr: empty ladder")
	}
	c := &Controller{ladder: ladder, current: ladder[0]}
	return c
}

// Update chooses the highest profile whose bitrate does not exceed the provided bandwidth.
// The bandwidth is in bits per second.
func (c *Controller) Update(bandwidth int) Profile {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, p := range c.ladder {
		if bandwidth >= p.Bitrate {
			c.current = p
			return p
		}
	}
	// fallback to lowest profile if bandwidth below all rungs
	c.current = c.ladder[len(c.ladder)-1]
	return c.current
}

// Current returns the currently selected profile.
func (c *Controller) Current() Profile {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.current
}

// Apply calls fn with the current profile after Update.
func (c *Controller) Apply(bandwidth int, fn func(Profile)) Profile {
	p := c.Update(bandwidth)
	if fn != nil {
		fn(p)
	}
	return p
}
