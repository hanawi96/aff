// FAQ Modal Handler
(function() {
  console.log('=== FAQ Modal script loaded ===');
  
  function initFaqModal() {
    const modal = document.getElementById('faqModalOverlay');
    const closeX = document.getElementById('faqModalCloseX');
    const closeBtn = document.getElementById('faqModalCloseBtn');
    const questionBtn = document.getElementById('contactQuestionBtn');
    const faqItems = document.querySelectorAll('.faq-item');

    // If question button doesn't exist, this page doesn't need FAQ modal functionality
    if (!questionBtn) {
      console.log('FAQ Modal: Question button not found - skipping initialization (normal for cart page)');
      return;
    }

    console.log('=== Elements found ===', {
      modal: !!modal,
      modalDisplay: modal ? window.getComputedStyle(modal).display : 'N/A',
      modalPosition: modal ? window.getComputedStyle(modal).position : 'N/A',
      modalAlignItems: modal ? window.getComputedStyle(modal).alignItems : 'N/A',
      modalJustifyContent: modal ? window.getComputedStyle(modal).justifyContent : 'N/A',
      closeX: !!closeX,
      closeBtn: !!closeBtn,
      questionBtn: !!questionBtn,
      faqItemsCount: faqItems.length
    });

    // Log each FAQ item
    console.log('=== FAQ Items Details ===');
    faqItems.forEach((item, index) => {
      const text = item.querySelector('.faq-text');
      console.log(`FAQ ${index + 1}:`, text ? text.textContent : 'NO TEXT');
    });

    // Check modal body
    const modalBody = document.querySelector('.faq-modal-body');
    if (modalBody) {
      console.log('Modal body HTML length:', modalBody.innerHTML.length);
      console.log('Modal body children count:', modalBody.children.length);
    }

    // Make sure modal is hidden initially
    if (modal) {
      console.log('Ensuring modal is hidden initially');
      modal.classList.remove('active');
      modal.style.display = 'none';
      console.log('Modal display after hiding:', window.getComputedStyle(modal).display);
    }

    // Open modal
    console.log('=== Attaching click handler to question button ===');
    questionBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('=== Question button clicked! ===');
      if (modal) {
        console.log('Opening modal...');
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        console.log('Modal opened - display:', window.getComputedStyle(modal).display);
        console.log('Modal opened - position:', window.getComputedStyle(modal).position);
        console.log('Modal opened - alignItems:', window.getComputedStyle(modal).alignItems);
        console.log('Modal opened - justifyContent:', window.getComputedStyle(modal).justifyContent);
        console.log('Modal opened - zIndex:', window.getComputedStyle(modal).zIndex);
      } else {
        console.error('Modal element not found!');
      }
    });

    // Close modal function
    function closeModal() {
      console.log('=== Closing modal ===');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        document.body.style.overflow = '';
      }
    }

    // Close buttons
    if (closeX) {
      closeX.addEventListener('click', function() {
        console.log('Close X clicked');
        closeModal();
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        console.log('Close button clicked');
        closeModal();
      });
    }

    // Close on overlay click
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          console.log('Overlay clicked');
          closeModal();
        }
      });
    }

    // Close on ESC key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
        console.log('ESC key pressed');
        closeModal();
      }
    });

    // Toggle FAQ items
    faqItems.forEach(function(item, index) {
      const question = item.querySelector('.faq-question');
      if (question) {
        question.addEventListener('click', function() {
          console.log('FAQ item clicked:', index);
          const isActive = item.classList.contains('active');
          
          // Close all items
          faqItems.forEach(function(i) {
            i.classList.remove('active');
          });
          
          // Toggle current item
          if (!isActive) {
            item.classList.add('active');
          }
        });
      }
    });
    
    console.log('=== FAQ Modal initialization complete ===');
  }

  // Try to init immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initFaqModal, 500);
    });
  } else {
    setTimeout(initFaqModal, 500);
  }
})();
