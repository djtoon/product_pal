import React, { useState } from 'react';
import './TodoListPanel.css';
import { TodoItem } from '../../shared/types';

// Import task icons
import taskIcon from '../assets/icons/task.svg';
import taskProgressIcon from '../assets/icons/task_progress.svg';
import taskDoneIcon from '../assets/icons/task_done.svg';

interface TodoListPanelProps {
  todos: TodoItem[];
}

const TodoListPanel: React.FC<TodoListPanelProps> = ({ todos }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (todos.length === 0) {
    return null;
  }

  const completed = todos.filter(t => t.status === 'completed').length;
  const inProgress = todos.filter(t => t.status === 'in_progress').length;
  const total = todos.length;
  const progress = Math.round((completed / total) * 100);

  const getStatusIcon = (status: TodoItem['status']) => {
    switch (status) {
      case 'pending': return taskIcon;
      case 'in_progress': return taskProgressIcon;
      case 'completed': return taskDoneIcon;
      case 'cancelled': return taskIcon; // Use task icon with different styling for cancelled
      default: return taskIcon;
    }
  };

  const getStatusClass = (status: TodoItem['status']) => {
    return `todo-item-${status.replace('_', '-')}`;
  };

  return (
    <div className="todo-list-panel">
      <div 
        className="todo-list-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="todo-list-header-left">
          <span className="todo-list-toggle">{isExpanded ? '▼' : '▶'}</span>
          <span className="todo-list-title">Task Progress</span>
        </div>
        <div className="todo-list-header-right">
          <div className="todo-progress-bar">
            <div 
              className="todo-progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="todo-progress-text">
            {completed}/{total}
            {inProgress > 0 && <span className="todo-in-progress-badge">{inProgress} active</span>}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="todo-list-content">
          {todos.map((todo, index) => (
            <div 
              key={todo.id} 
              className={`todo-list-item ${getStatusClass(todo.status)}`}
            >
              <span className="todo-item-number">{index + 1}.</span>
              <img src={getStatusIcon(todo.status)} alt="" className="todo-item-icon" />
              <span className="todo-item-content">{todo.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TodoListPanel;

