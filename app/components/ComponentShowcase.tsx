'use client';

import { useState } from 'react';

export default function ComponentShowcase() {
  const [switchChecked, setSwitchChecked] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectValue, setSelectValue] = useState('');

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Component Library Showcase</h1>
      
      {/* Buttons Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Buttons</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="btn btn-sm btn-solid">Small Solid</button>
          <button className="btn btn-solid">Medium Solid</button>
          <button className="btn btn-lg btn-solid">Large Solid</button>
          <button className="btn btn-xl btn-solid">Extra Large</button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="btn btn-sm btn-outline">Small Outline</button>
          <button className="btn btn-outline">Medium Outline</button>
          <button className="btn btn-lg btn-outline">Large Outline</button>
          <button className="btn btn-xl btn-outline">Extra Large</button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="btn btn-sm btn-ghost">Small Ghost</button>
          <button className="btn btn-ghost">Medium Ghost</button>
          <button className="btn btn-lg btn-ghost">Large Ghost</button>
          <button className="btn btn-xl btn-ghost">Extra Large</button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="btn btn-sm btn-secondary">Secondary</button>
          <button className="btn btn-sm btn-accent">Accent</button>
          <button className="btn btn-sm btn-success">Success</button>
          <button className="btn btn-sm btn-warning">Warning</button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="btn btn-sm btn-danger">Danger</button>
          <button className="btn btn-sm btn-neutral">Neutral</button>
          <button className="btn btn-sm btn-loading">Loading</button>
          <button className="btn btn-sm btn-disabled">Disabled</button>
        </div>
      </section>
      
      {/* Form Elements Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Form Elements</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="form-group">
            <label className="form-label">Standard Input</label>
            <input 
              type="text" 
              className="input" 
              placeholder="Enter text..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label form-label-required">Required Input</label>
            <input 
              type="email" 
              className="input input-error" 
              placeholder="Enter email..."
            />
            <div className="form-error">This field is required</div>
          </div>
          
          <div className="form-group">
            <label className="form-label">Success Input</label>
            <input 
              type="text" 
              className="input input-success" 
              placeholder="Valid input..."
            />
            <div className="form-success">Input is valid</div>
          </div>
          
          <div className="form-group">
            <label className="form-label">Warning Input</label>
            <input 
              type="text" 
              className="input input-warning" 
              placeholder="Warning state..."
            />
            <div className="form-help">This input has a warning</div>
          </div>
          
          <div className="form-group">
            <label className="form-label">Disabled Input</label>
            <input 
              type="text" 
              className="input input-disabled" 
              placeholder="Disabled input..."
              disabled
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Select Dropdown</label>
            <select 
              className="select" 
              value={selectValue}
              onChange={(e) => setSelectValue(e.target.value)}
            >
              <option value="">Choose an option...</option>
              <option value="option1">Option 1</option>
              <option value="option2">Option 2</option>
              <option value="option3">Option 3</option>
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">Textarea</label>
            <textarea 
              className="textarea" 
              placeholder="Enter your message..."
              rows={3}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Input Group</label>
            <div className="input-group">
              <div className="input-group-prepend">
                <span className="text-gray-500">$</span>
              </div>
              <input 
                type="text" 
                className="input input-prepend" 
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      </section>
      
      {/* Checkboxes and Switches Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Checkboxes & Switches</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input type="checkbox" className="checkbox" defaultChecked />
              <label className="text-sm text-gray-700">Checked checkbox</label>
            </div>
            
            <div className="flex items-center space-x-2">
              <input type="checkbox" className="checkbox" />
              <label className="text-sm text-gray-700">Unchecked checkbox</label>
            </div>
            
            <div className="flex items-center space-x-2">
              <input type="radio" className="radio" name="radio-group" defaultChecked />
              <label className="text-sm text-gray-700">Selected radio</label>
            </div>
            
            <div className="flex items-center space-x-2">
              <input type="radio" className="radio" name="radio-group" />
              <label className="text-sm text-gray-700">Unselected radio</label>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <button 
                className={`switch ${switchChecked ? 'switch-checked' : ''}`}
                onClick={() => setSwitchChecked(!switchChecked)}
              >
                <span className={`switch-thumb ${switchChecked ? 'switch-thumb-checked' : ''}`} />
              </button>
              <label className="text-sm text-gray-700">Toggle switch</label>
            </div>
          </div>
        </div>
      </section>
      
      {/* Badges Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Badges</h2>
        
        <div className="flex flex-wrap gap-2">
          <span className="badge badge-sm badge-primary">Small Primary</span>
          <span className="badge badge-primary">Primary</span>
          <span className="badge badge-lg badge-primary">Large Primary</span>
          <span className="badge badge-secondary">Secondary</span>
          <span className="badge badge-accent">Accent</span>
          <span className="badge badge-success">Success</span>
          <span className="badge badge-warning">Warning</span>
          <span className="badge badge-danger">Danger</span>
          <span className="badge badge-neutral">Neutral</span>
        </div>
      </section>
      
      {/* Alerts Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Alerts</h2>
        
        <div className="space-y-4">
          <div className="alert alert-info">
            <div className="font-medium">Info Alert</div>
            <div className="text-sm">This is an informational message.</div>
          </div>
          
          <div className="alert alert-success">
            <div className="font-medium">Success Alert</div>
            <div className="text-sm">Operation completed successfully.</div>
          </div>
          
          <div className="alert alert-warning">
            <div className="font-medium">Warning Alert</div>
            <div className="text-sm">Please review your input before proceeding.</div>
          </div>
          
          <div className="alert alert-danger">
            <div className="font-medium">Danger Alert</div>
            <div className="text-sm">An error occurred. Please try again.</div>
          </div>
        </div>
      </section>
      
      {/* Progress Bars Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Progress Bars</h2>
        
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Progress</span>
              <span>75%</span>
            </div>
            <div className="progress">
              <div className="progress-bar" style={{ width: '75%' }}></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Success</span>
              <span>100%</span>
            </div>
            <div className="progress">
              <div className="progress-bar progress-bar-success" style={{ width: '100%' }}></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Warning</span>
              <span>60%</span>
            </div>
            <div className="progress">
              <div className="progress-bar progress-bar-warning" style={{ width: '60%' }}></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Danger</span>
              <span>25%</span>
            </div>
            <div className="progress">
              <div className="progress-bar progress-bar-danger" style={{ width: '25%' }}></div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Spinners Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Spinners</h2>
        
        <div className="flex items-center space-x-4">
          <div className="spinner spinner-sm"></div>
          <div className="spinner spinner-md"></div>
          <div className="spinner spinner-lg"></div>
          <span className="text-sm text-gray-600">Loading...</span>
        </div>
      </section>
      
      {/* Avatars Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Avatars</h2>
        
        <div className="flex items-center space-x-4">
          <div className="avatar avatar-sm">A</div>
          <div className="avatar avatar-md">B</div>
          <div className="avatar avatar-lg">C</div>
          <div className="avatar avatar-xl">D</div>
        </div>
      </section>
    </div>
  );
}
