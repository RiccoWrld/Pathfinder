import { useState } from 'react';
import NotificationArea from './components/NotificationArea';
import './App.css';

function App() {
  const currentStudentId = 1;

  return (
    <>
      <section id="center">
        <div className="hero">
          {/*Hero Img*/}
        </div>
      

        <NotificationArea studentId={currentStudentId} />

      </section>
    </>
  )
}

export default App;