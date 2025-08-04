#!/usr/bin/env bash
#
# watch-events.sh
#
# Usage:
#   watch-events.sh [topic1 topic2 topic3 …]
#
# If you don’t pass any args it defaults to:
#   capture.service_up, events.schemas, capture.device_list

URL="amqp://video:video@localhost:5672/%2F"
EXCHANGE="events"
SESSION="events-watch"

if [ $# -gt 0 ]; then
  TOPICS=("$@")
else
  TOPICS=(
    "capture.service_up"
    "events.schemas"
    "capture.device_list"
  )
fi

# tear down any old session
tmux kill-session -t $SESSION 2>/dev/null

# start fresh
tmux new-session -d -s $SESSION -n watcher

# pane 0
topic="${TOPICS[0]}"
queue="watch_${topic//./_}"
tmux send-keys -t $SESSION:0.0 \
  "amqp-consume \\
    -u $URL \\
    -e $EXCHANGE \\
    -r '$topic' \\
    -q $queue \\
    -d -A \\
    jq ." C-m

# now one split per additional topic
for i in "${!TOPICS[@]}"; do
  if [ "$i" -eq 0 ]; then continue; fi
  tmux split-window -v -t $SESSION:0.$((i-1))
  topic="${TOPICS[i]}"
  queue="watch_${topic//./_}"
  tmux send-keys -t $SESSION:0.$i \
    "amqp-consume \\
      -u $URL \\
      -e $EXCHANGE \\
      -r '$topic' \\
      -q $queue \\
      -d -A \\
      jq ." C-m
done

# final pane: restart helper
last=$(( ${#TOPICS[@]} - 1 ))
tmux split-window -v -t $SESSION:0.$last
tmux send-keys -t $SESSION:0.$((last+1)) \
  "echo '↻ Press ENTER to restart capture-daemon…'; read; docker-compose restart capture-daemon" C-m

# make them even-height
tmux select-layout -t $SESSION even-vertical

# attach
tmux attach -t $SESSION