package stream

// selectAdapter returns the first adapter matching order and remaining fallback list.
func selectAdapter(order []string, caps Capabilities, factory func(string) Adapter) (Adapter, []string) {
	for i, p := range order {
		if caps.Has(p) {
			return factory(p), order[i+1:]
		}
	}
	if len(order) > 0 {
		return factory(order[len(order)-1]), nil
	}
	return factory(""), nil
}
