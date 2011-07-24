;; Ported the demo stuff from CoffeeScript; thanks!

;; TODO: Definition and assignment
(defvar number 42)
(defvar opposite false)
(set! opposite true)

;; Conditions:
(if opposite (set! number -42))

;; Functions:
(def (square x) (* x x))

;; TODO: Arrays:
(defvar list [1 2 3 4 5])

;; TODO: Objects:
(defvar math { :root   Math:sqrt
               :square square
               :foo (let ((x 10))
                      (for ((i (range 0 x))) (+ i x)))
               :cube   (lambda (x) (* x (square x))) })

;; Local bindings
(console:log number)
(let ((number (+ number 10))
      (another 1))
  (console:log number))
(console:log number)

;; ;; TODO: Splats:
;; race = (winner, runners...) ->
;; print winner, runners

;; Array comprehensions:
(defvar cubes (for ((n list)) (math:cube n)))
